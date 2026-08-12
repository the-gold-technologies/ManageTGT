'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getConversations, getMessages, sendMessage, getChatUsers, getOrCreateDM,
  convertMessageToTask, createChannel, pinMessage, toggleReaction,
  addGroupMember, removeGroupMember, markConversationAsRead,
  editMessage, deleteMessage, getThreadReplies, sendThreadReply, searchMessages
} from '@/app/actions/chat'
import { uploadFileAction } from '@/app/actions/upload'
import { MentionDropdown } from './mention-dropdown'
import { formatMentionToken } from '@/lib/chat-mentions'
import { useSocket } from '@/components/providers/socket-provider'
import { useSession } from 'next-auth/react'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, UserMinus, UserPlus, Search, Hash, Loader2 } from 'lucide-react'

import { ChatSidebar } from './sidebar/chat-sidebar'
import { ChatWindow } from './window/chat-window'
import { RichMessageInput } from './input/rich-message-input'
import { CreateChannelModal } from './sidebar/create-channel-modal'
import { ThreadPanel } from './thread/thread-panel'

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const { data: session } = useSession()
  const { socket, onlineUsers, isConnected } = useSocket()
  const queryClient = useQueryClient()

  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [pendingFile, setPendingFile] = useState<{ file: File; name: string; type: string; url: string } | null>(null)

  // Channel Creation State
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  // Mentions State
  const [mentionType, setMentionType] = useState<'user' | 'task' | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const editorApiRef = useRef<{
    insertMention: (display: string, token?: string) => void
  } | null>(null)
  const [cursorPos, setCursorPos] = useState({ bottom: 60, left: 20 })

  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false)
  const [groupSearchQuery, setGroupSearchQuery] = useState('')
  const [isProcessingMember, setIsProcessingMember] = useState<string | null>(null)

  // Thread state
  const [threadParentId, setThreadParentId] = useState<string | null>(null)
  const [threadReplies, setThreadReplies] = useState<any[]>([])
  const [threadLoading, setThreadLoading] = useState(false)

  // Edit state
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Thread file upload state (separate from main)
  const [threadPendingFile, setThreadPendingFile] = useState<any>(null)
  const [threadIsUploading, setThreadIsUploading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const threadFileInputRef = useRef<HTMLInputElement>(null)

  // ─── Data Fetching ─────────────────────────────────────────
  const { data: conversationsData, isLoading: convsLoading } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const res = await getConversations()
      if (!res.success) throw new Error(res.error)
      return res.conversations
    },
    enabled: isOpen,
  })

  const activeConv = conversationsData?.find((c: any) => c.id === activeConvId)

  // How many messages were unread when this conversation was opened. Frozen on
  // open so the divider stays where the reader left off instead of sliding away
  // as soon as the conversation is marked read.
  const [unreadAtOpen, setUnreadAtOpen] = useState(0)

  const { data: usersData } = useQuery({
    queryKey: ['chat-users'],
    queryFn: async () => {
      const res = await getChatUsers()
      if (!res.success) throw new Error(res.error)
      return res.users
    },
    enabled: isOpen && !activeConvId,
  })

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', activeConvId],
    queryFn: async () => {
      if (!activeConvId) return []
      const res = await getMessages(activeConvId)
      if (!res.success) throw new Error(res.error)
      return res.messages
    },
    enabled: !!activeConvId,
  })

  /**
   * The message the "New" divider sits above: counting back from the newest,
   * skipping your own messages, because unreadCount is computed the same way.
   */
  const firstUnreadId = useMemo<string | null>(() => {
    if (unreadAtOpen <= 0 || messages.length === 0) return null
    const fromOthers = messages.filter((m: any) => m.sender_id !== session?.user?.id)
    if (fromOthers.length < unreadAtOpen) return fromOthers[0]?.id ?? null
    return fromOthers[fromOthers.length - unreadAtOpen]?.id ?? null
  }, [messages, unreadAtOpen, session?.user?.id])

  // ─── Effects ───────────────────────────────────────────────
  // Jump to the bottom when a conversation is opened or an attachment changes
  // the composer height. Following *new messages* is ChatWindow's job, which
  // only does it when the reader is already at the live edge — scrolling from
  // here as well would drag them back down while they read history.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [activeConvId, pendingFile])

  // Mark conversation as read
  useEffect(() => {
    if (activeConvId) {
      // Snapshot the unread count before clearing it, so the "New" divider has
      // something to anchor to. Reading it after the write would always be 0.
      const opened = queryClient
        .getQueryData<any[]>(['chat-conversations'])
        ?.find(c => c.id === activeConvId)
      setUnreadAtOpen(opened?.unreadCount || 0)

      markConversationAsRead(activeConvId).then(() => {
        queryClient.setQueryData(['chat-conversations'], (old: any) => {
          if (!old) return old
          return old.map((c: any) =>
            c.id === activeConvId ? { ...c, unreadCount: 0, mentionCount: 0 } : c)
        })
        queryClient.invalidateQueries({ queryKey: ['global-unread-chat-count'] })
      })
    }
  }, [activeConvId, queryClient])

  // Global socket listener
  useEffect(() => {
    if (!socket) return

    const handleGlobalNewMessage = (newMsg: any) => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['global-unread-chat-count'] })

      if (activeConvId === newMsg.conversation_id || activeConvId === newMsg.conversationId) {
        queryClient.setQueryData(['chat-messages', activeConvId], (old: any) => {
          if (!old) return [newMsg]
          if (old.some((m: any) => m.id === newMsg.id)) return old
          return [...old, newMsg]
        })
        if (activeConvId) {
          markConversationAsRead(activeConvId).then(() => {
            queryClient.invalidateQueries({ queryKey: ['global-unread-chat-count'] })
          })
        }
      } else {
        toast(`New message from ${newMsg.sender?.name || 'Someone'}`)
      }
    }

    const handleMessageEdited = (editedMsg: any) => {
      const convId = editedMsg.conversation_id || editedMsg.conversationId
      queryClient.setQueryData(['chat-messages', convId], (old: any) => {
        if (!old) return old
        return old.map((m: any) => m.id === editedMsg.id ? { ...m, ...editedMsg } : m)
      })
    }

    const handleMessageDeleted = (deletedMsg: any) => {
      const convId = deletedMsg.conversation_id || deletedMsg.conversationId
      queryClient.setQueryData(['chat-messages', convId], (old: any) => {
        if (!old) return old
        return old.map((m: any) =>
          m.id === deletedMsg.id ? { ...m, is_deleted: true, content: '', reactions: {} } : m
        )
      })
    }

    const handleThreadReply = (replyData: any) => {
      if (threadParentId === replyData.reply_to_id) {
        setThreadReplies(prev => {
          if (prev.some(r => r.id === replyData.id)) return prev
          return [...prev, replyData]
        })
      }
      // Also update the parent message's reply count in the main feed
      const convId = replyData.conversation_id || replyData.conversationId
      queryClient.invalidateQueries({ queryKey: ['chat-messages', convId] })
    }

    const handleMessageReacted = (reactedMsg: any) => {
      const convId = reactedMsg.conversation_id || reactedMsg.conversationId
      queryClient.setQueryData(['chat-messages', convId], (old: any) => {
        if (!old) return old
        return old.map((m: any) => m.id === reactedMsg.id ? { ...m, reactions: reactedMsg.reactions } : m)
      })
    }

    socket.on('message:new', handleGlobalNewMessage)
    socket.on('message:edited', handleMessageEdited)
    socket.on('message:deleted', handleMessageDeleted)
    socket.on('thread:new-reply', handleThreadReply)
    socket.on('message:reacted', handleMessageReacted)

    return () => {
      socket.off('message:new', handleGlobalNewMessage)
      socket.off('message:edited', handleMessageEdited)
      socket.off('message:deleted', handleMessageDeleted)
      socket.off('thread:new-reply', handleThreadReply)
      socket.off('message:reacted', handleMessageReacted)
    }
  }, [socket, activeConvId, queryClient, threadParentId])

  // Room joining and typing
  useEffect(() => {
    if (!socket || !activeConvId || !isConnected) return
    socket.emit('conversation:join', activeConvId)

    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const next = new Set(prev)
        if (data.isTyping) next.add(data.userId)
        else next.delete(data.userId)
        return next
      })
    }

    socket.on('typing:update', handleTyping)
    return () => {
      socket.emit('conversation:leave', activeConvId)
      socket.off('typing:update', handleTyping)
    }
  }, [socket, activeConvId, isConnected])

  // Typing timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isTyping && socket && activeConvId && session?.user?.id) {
        socket.emit('typing:stop', { conversationId: activeConvId, userId: session.user.id })
        setIsTyping(false)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [isTyping, socket, activeConvId, session?.user?.id])

  // Load thread replies when thread opens
  useEffect(() => {
    if (!threadParentId) {
      setThreadReplies([])
      return
    }
    setThreadLoading(true)
    getThreadReplies(threadParentId).then(res => {
      if (res.success && res.replies) {
        setThreadReplies(res.replies)
      }
      setThreadLoading(false)
    })
  }, [threadParentId])

  // ─── Handlers ──────────────────────────────────────────────

  const handleMentionSelect = (item: { id: string; display: string; type: 'user' | 'task' }) => {
    const isBroadcast = item.id.startsWith('__')

    // A person mention is inserted as `@[Name](id)`, so the id travels with the
    // text. Deleting the mention removes the id with it, and the server can
    // resolve recipients from the message body rather than a parallel list.
    editorApiRef.current?.insertMention(
      item.display,
      item.type === 'user' && !isBroadcast
        ? formatMentionToken(item.display, item.id)
        : undefined,
    )

    setMentionType(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPendingFile({ file, name: file.name, type: file.type, url })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleThreadFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setThreadPendingFile({ file, name: file.name, type: file.type, url })
    if (threadFileInputRef.current) threadFileInputRef.current.value = ''
  }

  // Main send handler
  const handleSend = async (html: string, plainText: string) => {
    if ((!plainText.trim() && !pendingFile) || !activeConvId || !session?.user?.id) return

    const msgContent = html || plainText || pendingFile?.name || 'File attachment'

    let attachmentUrl: string | null = null
    if (pendingFile) {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', pendingFile.file)
      formData.append('folder', 'chat-attachments')
      try {
        const result = await uploadFileAction(formData)
        if (result.success && result.url) {
          attachmentUrl = result.url
        } else {
          toast.error('Failed to upload file')
          setIsUploading(false)
          return
        }
      } catch {
        toast.error('Upload error')
        setIsUploading(false)
        return
      }
      setIsUploading(false)
      setPendingFile(null)
    }

    if (socket) {
      socket.emit('typing:stop', { conversationId: activeConvId, userId: session.user.id })
    }

    // Handle edit mode
    if (editingMessage) {
      const editRes = await editMessage(editingMessage.id, msgContent)
      if (editRes.success) {
        queryClient.setQueryData(['chat-messages', activeConvId], (old: any) =>
          (old || []).map((m: any) => m.id === editingMessage.id ? { ...m, content: msgContent, is_edited: true } : m)
        )
        if (socket) {
          socket.emit('message:edit', { ...editRes.message, conversation_id: activeConvId })
        }
        toast.success('Message edited')
      }
      setEditingMessage(null)
      return
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const repliedMsg = replyingToId ? messages.find((m: any) => m.id === replyingToId) : null
    const optimisticMsg = {
      id: tempId,
      content: msgContent,
      attachment_url: attachmentUrl,
      sender_id: session.user.id,
      conversation_id: activeConvId,
      reply_to_id: replyingToId,
      reply_to: repliedMsg,
      createdAt: new Date().toISOString(),
      sender: { id: session.user.id, name: session.user.name, image: session.user.image },
      reactions: {},
      replies: []
    }

    const currentReplyId = replyingToId
    setReplyingToId(null)

    queryClient.setQueryData(['chat-messages', activeConvId], (old: any) => [...(old || []), optimisticMsg])

    if (socket) {
      socket.emit('message:send', optimisticMsg)
    }

    try {
      const res = await sendMessage(
        activeConvId,
        msgContent,
        attachmentUrl || undefined,
        currentReplyId || undefined,
      )
      if (res.success && res.message) {
        queryClient.setQueryData(['chat-messages', activeConvId], (old: any) =>
          (old || []).map((msg: any) => msg.id === tempId ? { ...res.message, replies: [] } : msg)
        )
      }
    } catch {
      toast.error('Failed to send message')
      queryClient.setQueryData(['chat-messages', activeConvId], (old: any) =>
        (old || []).filter((msg: any) => msg.id !== tempId)
      )
    }
  }

  // Thread reply handler
  const handleSendThreadReply = async (html: string, plainText: string, alsoSendToChannel: boolean) => {
    if (!threadParentId || !session?.user?.id) return

    const msgContent = html || plainText

    let attachmentUrl: string | null = null
    if (threadPendingFile) {
      setThreadIsUploading(true)
      const formData = new FormData()
      formData.append('file', threadPendingFile.file)
      formData.append('folder', 'chat-attachments')
      try {
        const result = await uploadFileAction(formData)
        if (result.success && result.url) attachmentUrl = result.url
      } catch {}
      setThreadIsUploading(false)
      setThreadPendingFile(null)
    }

    // Optimistic thread reply
    const tempId = `temp-thread-${Date.now()}`
    const optimisticReply = {
      id: tempId,
      content: msgContent,
      attachment_url: attachmentUrl,
      sender_id: session.user.id,
      reply_to_id: threadParentId,
      createdAt: new Date().toISOString(),
      sender: { id: session.user.id, name: session.user.name, image: session.user.image },
      reactions: {},
      replies: []
    }

    setThreadReplies(prev => [...prev, optimisticReply])

    if (socket) {
      socket.emit('thread:reply', { ...optimisticReply, conversation_id: activeConvId })
    }

    try {
      const res = await sendThreadReply(
        threadParentId,
        msgContent,
        attachmentUrl || undefined,
        alsoSendToChannel,
      )
      if (res.success && res.reply) {
        setThreadReplies(prev => prev.map(r => r.id === tempId ? res.reply : r))
        queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
      }
    } catch {
      toast.error('Failed to send reply')
      setThreadReplies(prev => prev.filter(r => r.id !== tempId))
    }
  }

  // Edit handler
  const handleEditMessage = (msgId: string, content: string) => {
    setEditingMessage({ id: msgId, content })
    setThreadParentId(null) // close thread if open
  }

  // Delete handler
  const handleDeleteMessage = async (msgId: string) => {
    // Optimistic
    queryClient.setQueryData(['chat-messages', activeConvId], (old: any) =>
      (old || []).map((m: any) => m.id === msgId ? { ...m, is_deleted: true, content: '', reactions: {} } : m)
    )

    const res = await deleteMessage(msgId)
    if (res.success) {
      if (socket) {
        socket.emit('message:delete', { id: msgId, conversation_id: activeConvId })
      }
    } else {
      toast.error(res.error || 'Failed to delete')
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
    }
  }

  // Reaction handler
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!session?.user?.id || !activeConvId) return

    queryClient.setQueryData(['chat-messages', activeConvId], (oldData: any) => {
      if (!oldData) return oldData
      return oldData.map((msg: any) => {
        if (msg.id === messageId) {
          const currentReactions = { ...(msg.reactions || {}) }
          let hadThisEmoji = false

          for (const [key, users] of Object.entries(currentReactions)) {
            const userList = (users as string[]) || []
            const filtered = userList.filter((id: string) => id !== session.user.id)
            if (key === emoji && userList.length !== filtered.length) hadThisEmoji = true
            if (filtered.length > 0) currentReactions[key] = filtered
            else delete currentReactions[key]
          }

          if (!hadThisEmoji) {
            currentReactions[emoji] = [...(currentReactions[emoji] || []), session.user.id]
          }

          return { ...msg, reactions: currentReactions }
        }
        return msg
      })
    })

    const res = await toggleReaction(messageId, emoji)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
      if (socket) socket.emit('message:react', res.message)
    } else {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
    }
  }

  // Pin handler
  const handlePin = async (messageId: string, isPinned: boolean) => {
    const res = await pinMessage(messageId, isPinned)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
      toast.success(isPinned ? 'Message pinned' : 'Message unpinned')
    } else {
      toast.error(res.error)
    }
  }

  // Convert to task
  const handleConvertToTask = async (msgContent: string) => {
    const projectId = activeConv?.project?.id || null
    toast.promise(convertMessageToTask(msgContent, projectId), {
      loading: 'Converting to task...',
      success: (data) => {
        if (!data.success) throw new Error(data.error || 'Failed')
        return 'Converted to task!'
      },
      error: (err: any) => err.message
    })
  }

  // Group member toggle
  const handleToggleGroupMember = async (userId: string, isMember: boolean) => {
    if (!activeConvId) return
    const action = isMember ? removeGroupMember : addGroupMember
    const res = await action(activeConvId, userId)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      toast.success(isMember ? 'Member removed' : 'Member added')
    } else {
      toast.error(res.error || 'Failed')
    }
  }

  // Create channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return toast.error('Channel name required')
    setIsSubmittingChannel(true)
    try {
      const res = await createChannel(newChannelName.trim(), selectedMembers)
      if (res.success && res.conversation) {
        toast.success('Channel created!')
        setIsCreatingChannel(false)
        setNewChannelName('')
        setSelectedMembers([])
        queryClient.setQueryData(['chat-conversations'], (old: any) => [res.conversation, ...(old || [])])
        setActiveConvId(res.conversation.id)
        if (socket) socket.emit('channel:created', res.conversation)
      } else {
        toast.error('Failed to create channel')
      }
    } finally {
      setIsSubmittingChannel(false)
    }
  }

  // Search
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const res = await searchMessages(query)
    if (res.success && res.messages) {
      setSearchResults(res.messages)
    }
    setIsSearching(false)
  }

  // Get channel name for thread panel
  const channelName = activeConv?.is_group ? (activeConv?.name || 'General') : ''
  const threadParentMsg = threadParentId ? messages.find((m: any) => m.id === threadParentId) : null
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '120%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '120%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-4 right-4 bottom-4 w-[1100px] max-w-[calc(100vw-2rem)] bg-bg border border-border rounded-2xl z-50 flex shadow-2xl overflow-hidden"
          >
            <ChatSidebar
              conversations={conversationsData || []}
              users={usersData || []}
              activeConvId={activeConvId}
              setActiveConvId={(id) => {
                setActiveConvId(id)
                setThreadParentId(null) // close thread
                setEditingMessage(null) // cancel edit
              }}
              onlineUsers={onlineUsers}
              sessionUserId={session?.user?.id}
              isLoading={convsLoading}
              onClose={onClose}
              isMobile={isMobile}
              onOpenCreateChannel={() => setIsCreatingChannel(true)}
              onStartDM={async (userId) => {
                const res = await getOrCreateDM(userId)
                if (res.success && res.conversationId) {
                  setActiveConvId(res.conversationId)
                  queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
                }
              }}
            />

            <div className={`flex-1 flex flex-col h-full relative overflow-hidden bg-bg ${!activeConvId && 'hidden md:flex'}`}>
              <ChatWindow
                activeConv={activeConv}
                messages={messages}
                sessionUserId={session?.user?.id}
                onlineUsers={onlineUsers}
                isLoading={messagesLoading}
                onBack={() => setActiveConvId(null)}
                onClose={onClose}
                onPin={handlePin}
                onConvertToTask={handleConvertToTask}
                onReply={(id) => {
                  setReplyingToId(id)
                }}
                onReplyInThread={(id) => {
                  setThreadParentId(id)
                }}
                onReact={handleReaction}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                messagesEndRef={messagesEndRef}
                firstUnreadId={firstUnreadId}
                onNotifySettingsChanged={() => {
                  queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
                }}
                onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
                isMobile={isMobile}
                typingUsers={typingUsers}
              />

              {activeConvId && (
                <div className="relative flex-shrink-0">
                  <MentionDropdown
                    type={mentionType}
                    query={mentionQuery}
                    position={cursorPos}
                    onSelect={handleMentionSelect}
                    onClose={() => setMentionType(null)}
                    allowBroadcast={!!activeConv?.is_group}
                    allowEveryone={activeConv?.is_group && activeConv?.name === 'General'}
                  />
                  <RichMessageInput
                    onSend={handleSend}
                    channelName={activeConv?.is_group ? (activeConv?.name || 'General') : (activeConv?.participants?.find((p: any) => p.user_id !== session?.user?.id)?.user?.name || '')}
                    isUploading={isUploading}
                    pendingFile={pendingFile}
                    handleFileSelect={handleFileSelect}
                    setPendingFile={setPendingFile}
                    fileInputRef={fileInputRef}
                    replyingToMsg={replyingToId ? messages.find((m: any) => m.id === replyingToId) : null}
                    onCancelReply={() => setReplyingToId(null)}
                    editingMessage={editingMessage}
                    onCancelEdit={() => setEditingMessage(null)}
                    onMentionTrigger={(type, query) => {
                      setMentionType(type)
                      setMentionQuery(query)
                    }}
                    onMentionClose={() => setMentionType(null)}
                    onEditorReady={(api) => { editorApiRef.current = api }}
                  />
                </div>
              )}

              {/* Thread Panel */}
              <AnimatePresence>
                {threadParentId && threadParentMsg && (
                  <ThreadPanel
                    parentMessage={threadParentMsg}
                    replies={threadReplies}
                    isLoading={threadLoading}
                    sessionUserId={session?.user?.id}
                    channelName={channelName}
                    onClose={() => setThreadParentId(null)}
                    onSendReply={handleSendThreadReply}
                    onReact={handleReaction}
                    onPin={handlePin}
                    onConvertToTask={handleConvertToTask}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    isUploading={threadIsUploading}
                    pendingFile={threadPendingFile}
                    handleFileSelect={handleThreadFileSelect}
                    setPendingFile={setThreadPendingFile}
                    fileInputRef={threadFileInputRef}
                  />
                )}
              </AnimatePresence>

              {/* Group Info Overlay */}
              <AnimatePresence>
                {isGroupInfoOpen && activeConv?.is_group && (
                  <>
                    <div
                      className="absolute inset-0 z-[50]"
                      onClick={() => setIsGroupInfoOpen(false)}
                    />
                    <motion.div
                      initial={{ x: '100%', opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: '100%', opacity: 0 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      className="absolute top-0 right-0 bottom-0 w-[320px] bg-bg border-l border-border z-[60] shadow-2xl flex flex-col hidden md:flex"
                    >
                      <div className="p-4 border-b border-border flex justify-between items-center bg-bg-secondary shrink-0">
                        <h3 className="font-bold text-text text-[15px]">Channel Details</h3>
                        <button onClick={() => setIsGroupInfoOpen(false)} className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-text transition-colors">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                        {/* Channel Name & Description */}
                        <div className="p-4 border-b border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                              <Hash size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-text">{activeConv.name || 'General'}</h4>
                              <p className="text-[11px] text-text-muted">{activeConv.participants.length} members</p>
                            </div>
                          </div>
                          {activeConv.description && (
                            <p className="text-[13px] text-text-muted mt-2 leading-relaxed">{activeConv.description}</p>
                          )}
                        </div>

                        {/* Members */}
                        <div className="p-4 border-b border-border">
                          <h4 className="text-[11px] font-bold text-text-muted uppercase mb-3 tracking-wider">
                            Members ({activeConv.participants.length})
                          </h4>
                          <div className="space-y-0.5">
                            {activeConv.participants.map((p: any) => {
                              const isMe = p.user_id === session?.user?.id
                              return (
                                <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-tertiary transition-colors group">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0 overflow-hidden">
                                      {p.user?.image ? <img src={p.user.image} alt="" className="w-full h-full object-cover" /> : getInitials(p.user?.name || '?')}
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[13px] font-medium text-text truncate">{p.user?.name}</span>
                                      {isMe && <span className="text-[10px] text-text-muted">(you)</span>}
                                      {onlineUsers.has(p.user_id) && <div className="w-2 h-2 bg-success rounded-full shrink-0" />}
                                    </div>
                                  </div>
                                  {!isMe && (
                                    <button
                                      onClick={async () => {
                                        setIsProcessingMember(p.user_id)
                                        await handleToggleGroupMember(p.user_id, true)
                                        setIsProcessingMember(null)
                                      }}
                                      disabled={isProcessingMember === p.user_id}
                                      className="p-1.5 text-danger opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/10 rounded disabled:opacity-50 shrink-0"
                                      title="Remove"
                                    >
                                      <UserMinus size={14} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Add Members */}
                        <div className="p-4 flex-1">
                          <h4 className="text-[11px] font-bold text-text-muted uppercase mb-3 tracking-wider">Add People</h4>
                          <div className="relative mb-3">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              value={groupSearchQuery}
                              onChange={(e) => setGroupSearchQuery(e.target.value)}
                              placeholder="Search users..."
                              className="w-full bg-bg border border-border-muted rounded-lg pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-primary text-text"
                            />
                          </div>
                          <div className="space-y-0.5">
                            {usersData
                              ?.filter((u: any) =>
                                !activeConv.participants.some((p: any) => p.user_id === u.id) &&
                                (u.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                                  u.email?.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                              )
                              .map((user: any) => (
                                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-bg text-text-muted border border-border flex items-center justify-center text-xs shrink-0 overflow-hidden">
                                      {user.image ? <img src={user.image} alt="" className="w-full h-full object-cover" /> : getInitials(user.name || '?')}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[13px] font-medium text-text truncate">{user.name}</span>
                                      <span className="text-[10px] text-text-muted truncate">{user.email || user.role?.name}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      setIsProcessingMember(user.id)
                                      await handleToggleGroupMember(user.id, false)
                                      setIsProcessingMember(null)
                                    }}
                                    disabled={isProcessingMember === user.id}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50 shrink-0"
                                    title="Add"
                                  >
                                    <UserPlus size={14} />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <CreateChannelModal
            open={isCreatingChannel}
            onClose={() => setIsCreatingChannel(false)}
            users={usersData || []}
            channelName={newChannelName}
            setChannelName={setNewChannelName}
            selectedMembers={selectedMembers}
            setSelectedMembers={setSelectedMembers}
            onSubmit={handleCreateChannel}
            isSubmitting={isSubmittingChannel}
          />
        </>
      )}
    </AnimatePresence>
  )
}
