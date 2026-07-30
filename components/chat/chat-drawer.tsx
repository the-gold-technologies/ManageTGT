                                              'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, ArrowLeft, MessageSquare, Paperclip, Loader2, MoreHorizontal, User, Hash, Briefcase, Plus, Reply, Pin, Smile, ChevronDown } from 'lucide-react'
import { getConversations, getMessages, sendMessage, getChatUsers, getOrCreateDM, convertMessageToTask, createChannel, pinMessage, toggleReaction, addGroupMember, removeGroupMember, markConversationAsRead } from '@/app/actions/chat'
import { uploadFileAction } from '@/app/actions/upload'
import { MentionDropdown } from './mention-dropdown'
import { useSocket } from '@/components/providers/socket-provider'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { ChatSidebar } from './sidebar/chat-sidebar'
import { ChatWindow } from './window/chat-window'
import { MessageInput } from './input/message-input'
import { CreateChannelModal } from './sidebar/create-channel-modal'
import { UserMinus, UserPlus, Search } from 'lucide-react'

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const ANIMATED_EMOJIS = [
  { char: '👍', hex: '1f44d' },
  { char: '❤️', hex: '2764' },
  { char: '😂', hex: '1f602' },
  { char: '😮', hex: '1f62e' },
  { char: '😢', hex: '1f622' },
  { char: '🙏', hex: '1f64f' }
]

export default function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const { data: session } = useSession()
  const { socket, onlineUsers, isConnected } = useSocket()
  const queryClient = useQueryClient()
  
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [pendingFile, setPendingFile] = useState<{ file: File, name: string, type: string, url: string } | null>(null)
  
  // Channel Creation State
  const [isCreatingChannel, setIsCreatingChannel] = useState(false)
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  
  // Mentions State
  const [mentionType, setMentionType] = useState<'user' | 'task' | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [cursorPos, setCursorPos] = useState({ bottom: 60, left: 20 })

  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null) // stores message ID if picker is open
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false)
  const [openMessageDropdown, setOpenMessageDropdown] = useState<string | null>(null)
  
  const [groupSearchQuery, setGroupSearchQuery] = useState('')
  const [isProcessingMember, setIsProcessingMember] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch Conversations
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
  const otherParticipant = activeConv && !activeConv.is_group 
    ? activeConv.participants.find((p: any) => p.user_id !== session?.user?.id)?.user 
    : null
    
  const memberNames = activeConv && activeConv.is_group
    ? activeConv.participants
        .map((p: any) => p.user_id === session?.user?.id ? 'You' : p.user.name.split(' ')[0])
        .join(', ')
    : ''

  // Fetch users for new DM
  const { data: usersData } = useQuery({
    queryKey: ['chat-users'],
    queryFn: async () => {
      const res = await getChatUsers()
      if (!res.success) throw new Error(res.error)
      return res.users
    },
    enabled: isOpen && !activeConvId,
  })

  // Fetch Messages for active conversation
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingFile])

  // Mark conversation as read when opened
  useEffect(() => {
    if (activeConvId) {
      markConversationAsRead(activeConvId).then(() => {
        // Optimistically update the UI to remove the badge
        queryClient.setQueryData(['chat-conversations'], (old: any) => {
          if (!old) return old
          return old.map((c: any) => c.id === activeConvId ? { ...c, unreadCount: 0 } : c)
        })
        // Invalidate global unread count
        queryClient.invalidateQueries({ queryKey: ['global-unread-chat-count'] })
      })
    }
  }, [activeConvId, queryClient])

  // Global socket listener for new messages
  useEffect(() => {
    if (!socket) return
    
    const handleGlobalNewMessage = (newMsg: any) => {
      console.log('[Socket] Global received:', newMsg)
      
      // Update the conversations list query to show latest message snippet
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['global-unread-chat-count'] })
      
      // If we are currently in this conversation, update the messages list
      if (activeConvId === newMsg.conversation_id || activeConvId === newMsg.conversationId) {
        queryClient.setQueryData(['chat-messages', activeConvId], (old: any) => {
          if (!old) return [newMsg]
          if (old.some((m: any) => m.id === newMsg.id)) return old
          return [...old, newMsg]
        })
        // Since we are in the conversation, mark it as read immediately
        if (activeConvId) {
          markConversationAsRead(activeConvId).then(() => {
            queryClient.invalidateQueries({ queryKey: ['global-unread-chat-count'] })
          })
        }
      } else {
        // Optionally show a toast for messages received in other conversations
        toast(`New message from ${newMsg.sender?.name || 'Someone'}`)
      }
    }
    
    socket.on('message:new', handleGlobalNewMessage)
    return () => {
      socket.off('message:new', handleGlobalNewMessage)
    }
  }, [socket, activeConvId, queryClient])

  // Room joining and typing event listeners
  useEffect(() => {
    if (!socket || !activeConvId || !isConnected) return

    socket.emit('conversation:join', activeConvId)

    const handleTyping = (data: { userId: string, isTyping: boolean }) => {
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

  // Handle typing indicator timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isTyping && socket && activeConvId && session?.user?.id) {
        socket.emit('typing:stop', { conversationId: activeConvId, userId: session.user.id })
        setIsTyping(false)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [input, isTyping, socket, activeConvId, session?.user?.id])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    
    if (!isTyping && socket && activeConvId && session?.user?.id) {
      setIsTyping(true)
      socket.emit('typing:start', { conversationId: activeConvId, userId: session.user.id })
    }

    // Mention parsing
    const cursor = e.target.selectionStart || 0
    const textBeforeCursor = val.slice(0, cursor)
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)([@#])([\w\s-]*)$/)
    
    if (mentionMatch) {
      const type = mentionMatch[1] === '@' ? 'user' : 'task'
      const query = mentionMatch[2]
      setMentionType(type)
      setMentionQuery(query)
      setCursorPos({ bottom: 60, left: 60 }) 
    } else {
      setMentionType(null)
    }
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const handleMentionSelect = (item: { id: string, display: string, type: 'user' | 'task' }) => {
    const cursor = textareaRef.current?.selectionStart || input.length
    const textBeforeCursor = input.slice(0, cursor)
    const textAfterCursor = input.slice(cursor)
    
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)([@#])([\w\s-]*)$/)
    if (mentionMatch) {
      const startIndex = mentionMatch.index! + (mentionMatch[0].startsWith(' ') ? 1 : 0)
      const prefix = input.slice(0, startIndex)
      const tag = item.type === 'user' ? '@' : '#'
      const replacement = `${tag}[${item.display}](${item.id}) `
      
      const newVal = prefix + replacement + textAfterCursor
      setInput(newVal)
      
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursor = prefix.length + replacement.length
          textareaRef.current.selectionStart = newCursor
          textareaRef.current.selectionEnd = newCursor
          textareaRef.current.focus()
        }
      }, 0)
    }
    setMentionType(null)
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPendingFile({ file, name: file.name, type: file.type, url })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Handle send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && !pendingFile) || !activeConvId || !session?.user?.id) return

    const msgContent = input.trim() || pendingFile?.name || 'File attachment'
    setInput('')
    
    let attachmentUrl = null
    
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
      } catch (error) {
        toast.error('An error occurred during upload')
        setIsUploading(false)
        return
      }
      setIsUploading(false)
      setPendingFile(null)
    }

    if (socket) {
      socket.emit('typing:stop', { conversationId: activeConvId, userId: session.user.id })
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    
    // Find reply_to message if any
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
      sender: { id: session.user.id, name: session.user.name, image: session.user.image }
    }
    
    const currentReplyId = replyingToId
    setReplyingToId(null) // clear immediately for UX
    
    // 1. Immediately update local UI
    queryClient.setQueryData(['chat-messages', activeConvId], (old: any) => [...(old || []), optimisticMsg])

    // 2. Immediately send to other users via socket (Instant Delivery)
    if (socket) {
      socket.emit('message:send', optimisticMsg)
    }

    try {
      // 3. Save to database in the background
      const res = await sendMessage(activeConvId, msgContent, attachmentUrl || undefined, currentReplyId || undefined)
      if (res.success && res.message) {
        // Replace optimistic message with actual message from DB locally
        queryClient.setQueryData(['chat-messages', activeConvId], (old: any) => 
          (old || []).map((msg: any) => msg.id === tempId ? res.message : msg)
        )
      }
    } catch (error) {
      toast.error('Failed to send message')
      // Revert optimistic update on failure
      queryClient.setQueryData(['chat-messages', activeConvId], (old: any) => 
        (old || []).filter((msg: any) => msg.id !== tempId)
      )
    }
  }

  // Convert Message to Task
  const handleConvertToTask = async (msgContent: string) => {
    const projectId = activeConv?.project?.id || null
    
    toast.promise(convertMessageToTask(msgContent, projectId), {
      loading: 'Converting to task...',
      success: (data) => {
        if (!data.success) throw new Error(data.error || 'Failed to convert to task')
        return 'Successfully converted message to task!'
      },
      error: (err: any) => err.message
    })
  }
  
  // Handle Reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    setShowEmojiPicker(null)
    
    // Optimistic UI Update
    if (session?.user?.id && activeConvId) {
      queryClient.setQueryData(['chat-messages', activeConvId], (oldData: any) => {
        if (!oldData) return oldData
        return oldData.map((msg: any) => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || {}
            const newReactions: any = {}
            let hadOtherEmoji = false

            // Clean up the user from all emojis, and check if they had this specific emoji
            for (const [key, users] of Object.entries(currentReactions)) {
              const userList = (users as string[]) || []
              const filteredUsers = userList.filter((id: string) => id !== session.user.id)
              
              if (key === emoji && userList.length !== filteredUsers.length) {
                hadOtherEmoji = true // Toggling off the same emoji
              }
              
              if (filteredUsers.length > 0) {
                newReactions[key] = filteredUsers
              }
            }

            // If they didn't just toggle off their existing emoji, add the new one
            if (!hadOtherEmoji) {
              if (!newReactions[emoji]) newReactions[emoji] = []
              newReactions[emoji].push(session.user.id)
            }

            return { ...msg, reactions: newReactions }
          }
          return msg
        })
      })
    }

    const res = await toggleReaction(messageId, emoji)
    if (res.success) {
      // Sync in background
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
      if (socket) socket.emit('message:react', res.message)
    } else {
      toast.error(res.error)
      // Rollback on failure
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
    }
  }

  // Handle Group Member Toggle
  const handleToggleGroupMember = async (userId: string, isMember: boolean) => {
    if (!activeConvId) return
    const action = isMember ? removeGroupMember : addGroupMember
    const res = await action(activeConvId, userId)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      toast.success(isMember ? 'Member removed' : 'Member added')
    } else {
      toast.error(res.error || 'Failed to update members')
    }
  }

  // Handle Pin
  const handlePin = async (messageId: string, isPinned: boolean) => {
    const res = await pinMessage(messageId, isPinned)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConvId] })
      toast.success(isPinned ? 'Message pinned' : 'Message unpinned')
    } else {
      toast.error(res.error)
    }
  }

  // Start DM
  const startDM = async (userId: string) => {
    const res = await getOrCreateDM(userId)
    if (res.success && res.conversationId) {
      setActiveConvId(res.conversationId)
    } else {
      toast.error('Failed to start chat')
    }
  }

  // Create Channel
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
        // Optimistically update conversations list
        queryClient.setQueryData(['chat-conversations'], (old: any) => [res.conversation, ...(old || [])])
        setActiveConvId(res.conversation.id)
        
        // Notify other users to refresh their conversations via socket
        if (socket) {
          socket.emit('channel:created', res.conversation)
        }
      } else {
        toast.error('Failed to create channel')
      }
    } finally {
      setIsSubmittingChannel(false)
    }
  }

  // Parse Mentions and basic formatting
  const renderMessageContent = (content: string) => {
    if (!content) return null
    
    // Split by mention pattern: @[Display Name](id) or #[Display Name](id)
    const parts = content.split(/([@#]\[[^\]]+\]\([^)]+\))/g)
    
    return parts.map((part, i) => {
      const mentionMatch = part.match(/([@#])\[([^\]]+)\]\(([^)]+)\)/)
      if (mentionMatch) {
        const type = mentionMatch[1]
        const display = mentionMatch[2]
        
        return (
          <span key={i} className="inline-flex items-center gap-0.5 bg-primary/20 text-primary px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold cursor-pointer hover:bg-primary/30 transition-colors">
            {type === '@' ? '@' : '#'}
            {display}
          </span>
        )
      }
      
      // Basic markdown (bold, italic)
      let formattedText = part
      const boldParts = formattedText.split(/(\*\*.*?\*\*)/g)
      return (
        <React.Fragment key={i}>
          {boldParts.map((bPart, j) => {
            if (bPart.startsWith('**') && bPart.endsWith('**')) {
              return <strong key={j} className="font-semibold">{bPart.slice(2, -2)}</strong>
            }
            return bPart
          })}
        </React.Fragment>
      )
    })
  }


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
            className="fixed top-4 right-4 bottom-4 w-[1000px] max-w-[calc(100vw-2rem)] bg-bg border border-border rounded-2xl z-50 flex shadow-2xl overflow-hidden"
          >
            <ChatSidebar
              conversations={conversationsData || []}
              users={usersData || []}
              activeConvId={activeConvId}
              setActiveConvId={setActiveConvId}
              onlineUsers={onlineUsers}
              sessionUserId={session?.user?.id}
              isLoading={convsLoading}
              onClose={onClose}
              isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
              onOpenCreateChannel={() => setIsCreatingChannel(true)}
              onStartDM={async (userId) => {
                const res = await getOrCreateDM(userId)
                if (res.success && res.conversationId) {
                  setActiveConvId(res.conversationId)
                  queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
                }
              }}
            />

            <div className={`flex-1 flex flex-col h-full relative overflow-hidden bg-[#efeae2] dark:bg-[#0c1015] ${!activeConvId && 'hidden md:flex'}`}>
              
              {/* WhatsApp Doodle Background - Light Mode */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 opacity-[0.6] mix-blend-multiply dark:hidden"
                style={{
                  backgroundImage: 'url("/chat-bg.png")',
                  backgroundRepeat: 'repeat',
                  backgroundSize: '700px'
                }}
              />

              {/* WhatsApp Doodle Background - Dark Mode */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 hidden dark:block opacity-[0.5] invert mix-blend-screen"
                style={{
                  backgroundImage: 'url("/chat-bg.png")',
                  backgroundRepeat: 'repeat',
                  backgroundSize: '700px'
                }}
              />

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
                  textareaRef.current?.focus()
                }}
                onReact={handleReaction}
                messagesEndRef={messagesEndRef}
                onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
                isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
              />
              
              {activeConvId && (
                <div className="relative flex-shrink-0">
                  <MentionDropdown 
                    type={mentionType}
                    query={mentionQuery}
                    position={cursorPos}
                    onSelect={handleMentionSelect}
                    onClose={() => setMentionType(null)}
                  />
                  <MessageInput
                    input={input}
                    setInput={setInput}
                    onChange={handleInputChange}
                    handleSend={handleSend}
                    isTyping={isTyping}
                    isUploading={isUploading}
                    pendingFile={pendingFile}
                    handleFileSelect={handleFileSelect}
                    setPendingFile={setPendingFile}
                    textareaRef={textareaRef}
                    fileInputRef={fileInputRef}
                    replyingToMsg={replyingToId ? messages.find((m: any) => m.id === replyingToId) : null}
                    onCancelReply={() => setReplyingToId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !mentionType) {
                        e.preventDefault()
                        handleSend(e as any)
                      }
                    }}
                    onFocus={() => {}}
                  />
                </div>
              )}

              {/* Group Info Overlay */}
              <AnimatePresence>
                {isGroupInfoOpen && activeConv?.is_group && (
                  <>
                    {/* Click-outside backdrop */}
                    <div 
                      className="absolute inset-0 z-[50]" 
                      onClick={() => setIsGroupInfoOpen(false)}
                    />
                    <motion.div 
                      initial={{ x: '100%', opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: '100%', opacity: 0 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      className="absolute top-0 right-0 bottom-0 w-[320px] bg-bg-secondary border-l border-border z-[60] shadow-2xl flex flex-col hidden md:flex"
                    >
                     <div className="p-4 border-b border-border flex justify-between items-center bg-bg shrink-0">
                        <h3 className="font-semibold text-text">Group Info</h3>
                        <button onClick={() => setIsGroupInfoOpen(false)} className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-text transition-colors">
                          <X size={16} />
                        </button>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                       {/* Current Members */}
                       <div className="p-4 border-b border-border">
                          <h4 className="text-[11px] font-bold text-text-muted uppercase mb-3 tracking-wider">Members ({activeConv.participants.length})</h4>
                          <div className="space-y-1">
                            {activeConv.participants.map((p: any) => {
                              const isMe = p.user_id === session?.user?.id
                              return (
                                <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-tertiary transition-colors group">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs shrink-0 overflow-hidden">
                                      {p.user?.image ? <img src={p.user.image} alt="" className="w-full h-full object-cover"/> : getInitials(p.user?.name || '?')}
                                    </div>
                                    <span className="text-[13px] font-medium text-text truncate">
                                      {p.user?.name} {isMe && <span className="text-text-muted font-normal">(You)</span>}
                                    </span>
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
                              className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-primary/50 text-text"
                            />
                          </div>
                          <div className="space-y-1">
                            {usersData?.filter((u: any) => 
                              !activeConv.participants.some((p: any) => p.user_id === u.id) &&
                              (u.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()) || 
                               u.email?.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                            ).map((user: any) => (
                              <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-tertiary transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-bg text-text-muted border border-border flex items-center justify-center text-xs shrink-0 overflow-hidden">
                                    {user.image ? <img src={user.image} alt="" className="w-full h-full object-cover"/> : getInitials(user.name || '?')}
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
