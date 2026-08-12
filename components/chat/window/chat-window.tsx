'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Hash, X, Pin, Loader2, MessageSquare, Users, ArrowDown } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { MessageRow } from './message-row'
import { NotificationMenu } from './notification-menu'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatWindowProps {
  activeConv: any
  messages: any[]
  sessionUserId?: string
  onlineUsers: Set<string>
  isLoading: boolean
  onBack: () => void
  onClose: () => void
  onPin: (msgId: string, isPinned: boolean) => void
  onConvertToTask: (content: string) => void
  onReply: (msgId: string) => void
  onReplyInThread: (msgId: string) => void
  onReact: (msgId: string, emoji: string) => void
  onEdit: (msgId: string, content: string) => void
  onDelete: (msgId: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onOpenGroupInfo: () => void
  isMobile: boolean
  typingUsers?: Set<string>
  participants?: any[]
  /** Refetch conversations so the sidebar's muted state stays in step. */
  onNotifySettingsChanged?: () => void
  /** Id of the first unread message, used to place the "New" divider. */
  firstUnreadId?: string | null
}

export function ChatWindow({
  activeConv,
  messages,
  sessionUserId,
  onlineUsers,
  isLoading,
  onBack,
  onClose,
  onPin,
  onConvertToTask,
  onReply,
  onReplyInThread,
  onReact,
  onEdit,
  onDelete,
  messagesEndRef,
  onOpenGroupInfo,
  isMobile,
  typingUsers = new Set(),
  participants = [],
  onNotifySettingsChanged,
  firstUnreadId = null
}: ChatWindowProps) {
  const [showPinned, setShowPinned] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  // "Near" rather than "at" the bottom, so a few pixels of drift or a half
  // -scrolled image does not count as having scrolled away.
  const NEAR_BOTTOM_PX = 120

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsNearBottom(distance <= NEAR_BOTTOM_PX)
  }

  /**
   * Follow new messages only when the reader is already at the live edge.
   *
   * Scrolling unconditionally means that reading back through history gets
   * interrupted every time anyone posts — you lose your place mid-sentence.
   */
  useEffect(() => {
    if (!isNearBottom) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // isNearBottom is intentionally not a dependency: this should fire on new
    // messages, not the moment the reader happens to scroll back down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  const jumpToLatest = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsNearBottom(true)
  }

  if (!activeConv) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center bg-bg ${isMobile ? 'hidden' : 'flex'}`}>
        <div className="bg-bg-secondary p-10 rounded-2xl border border-border text-center max-w-sm w-full mx-4 shadow-sm">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={32} />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Start Connecting</h2>
          <p className="text-sm text-text-muted leading-relaxed">Select a conversation from the sidebar or start a new one to begin messaging your team.</p>
        </div>
      </div>
    )
  }

  const isGroup = activeConv.is_group
  const otherParticipant = !isGroup ? activeConv.participants?.find((p: any) => p.user_id !== sessionUserId)?.user : null
  const name = isGroup ? (activeConv.name || 'General') : (otherParticipant?.name || 'User')
  const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.id) : false
  const memberCount = activeConv.participants?.length || 0

  const pinnedMessages = messages.filter((m: any) => m.is_pinned)

  // Get typing user names
  const typingUserNames = Array.from(typingUsers)
    .filter(id => id !== sessionUserId)
    .map(id => {
      const participant = activeConv.participants?.find((p: any) => p.user_id === id)
      return participant?.user?.name?.split(' ')[0] || 'Someone'
    })

  return (
    <div className="flex-1 flex flex-col min-h-0 relative w-full h-full bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg z-10 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {isMobile && (
            <button onClick={onBack} className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-text transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
          )}

          <div
            className="flex items-center gap-3 overflow-hidden cursor-pointer group"
            onClick={isGroup ? onOpenGroupInfo : undefined}
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary overflow-hidden text-sm">
                {isGroup ? (
                  <Hash size={18} />
                ) : otherParticipant?.image ? (
                  <img src={otherParticipant.image} alt={name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(name)
                )}
              </div>
              {!isGroup && isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success border-2 border-bg rounded-full" />
              )}
            </div>

            <div className="flex flex-col overflow-hidden">
              <h2 className="font-bold text-text text-[15px] truncate group-hover:text-primary transition-colors">
                {name}
              </h2>
              <p className="text-[11px] text-text-muted truncate">
                {isGroup ? (
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {memberCount} members
                    {activeConv.description && <span className="ml-1">· {activeConv.description}</span>}
                  </span>
                ) : (
                  isOnline ? (
                    <span className="text-success font-medium">● Active</span>
                  ) : (
                    'Away'
                  )
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Pinned messages */}
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinned(!showPinned)}
              className={`relative p-2 rounded-lg transition-colors ${showPinned ? 'bg-primary/10 text-primary' : 'hover:bg-bg-tertiary text-text-muted hover:text-text'}`}
              title={`${pinnedMessages.length} pinned`}
            >
              <Pin size={18} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {pinnedMessages.length}
              </span>
            </button>
          )}

          <NotificationMenu
            conversationId={activeConv.id}
            isGroup={isGroup}
            onChanged={onNotifySettingsChanged}
          />

          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-text transition-colors"
            title="Close chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Pinned Messages Dropdown */}
      <AnimatePresence>
        {showPinned && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border bg-bg-secondary z-10 shrink-0 overflow-hidden"
          >
            <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Pin size={12} />
                  Pinned Messages
                </span>
                <button onClick={() => setShowPinned(false)} className="text-text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>
              {pinnedMessages.map(msg => (
                <div key={msg.id} className="bg-bg rounded-lg p-2.5 border border-border flex items-start gap-2 hover:bg-bg-tertiary transition-colors cursor-pointer">
                  <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden">
                    {msg.sender?.image ? (
                      <img src={msg.sender.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(msg.sender?.name || 'U')
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-semibold text-text">{msg.sender?.name}</span>
                      <span className="text-[10px] text-text-muted">
                        {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-muted truncate mt-0.5">{msg.content?.replace(/<[^>]*>/g, '')}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onPin(msg.id, false)
                    }}
                    className="p-1 text-text-muted hover:text-text rounded hover:bg-bg transition-colors shrink-0"
                    title="Unpin"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative z-10 custom-scrollbar flex flex-col bg-bg"
      >
        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
              {isGroup ? <Hash size={28} /> : <MessageSquare size={28} />}
            </div>
            <h3 className="text-base font-bold text-text mb-1">
              {isGroup ? `Welcome to #${name}` : `Start chatting with ${name}`}
            </h3>
            <p className="text-[13px] text-text-muted max-w-xs">
              {isGroup
                ? 'This is the very beginning of this channel. Send a message to get the conversation started!'
                : 'Send your first message to start this conversation.'}
            </p>
          </div>
        ) : (
          <div className="mt-auto flex flex-col">
            {/* Channel start indicator */}
            <div className="px-5 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {isGroup ? <Hash size={24} /> : (
                    otherParticipant?.image ? (
                      <img src={otherParticipant.image} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="font-bold text-lg">{getInitials(name)}</span>
                    )
                  )}
                </div>
              </div>
              <h3 className="text-lg font-bold text-text">
                {name}
              </h3>
              <p className="text-[13px] text-text-muted mt-0.5">
                {isGroup
                  ? `This is the start of the ${name} channel.`
                  : `This is the start of your conversation with ${name}.`}
              </p>
            </div>

            {/* Date separator + Messages */}
            {messages.map((msg, index) => {
              const isMe = msg.sender_id === sessionUserId

              const prevMsg = messages[index - 1]
              const isFirstInGroup = !prevMsg ||
                prevMsg.sender_id !== msg.sender_id ||
                (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000)

              // Date separator
              const showDateSep = index === 0 || (
                new Date(msg.createdAt).toDateString() !== new Date(messages[index - 1]?.createdAt).toDateString()
              )

              return (
                <React.Fragment key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[11px] font-semibold text-text-muted bg-bg px-2 shrink-0">
                        {new Date(msg.createdAt).toLocaleDateString([], {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  {/* Where you left off. Placed once, above the first message
                      you have not read, and it stays put while you read so the
                      feed does not reflow under you. */}
                  {firstUnreadId === msg.id && (
                    <div className="flex items-center gap-3 px-5 py-2">
                      <div className="flex-1 h-px bg-danger/50" />
                      <span className="text-[10px] font-bold text-danger uppercase tracking-wider shrink-0">
                        New
                      </span>
                      <div className="flex-1 h-px bg-danger/50" />
                    </div>
                  )}

                  {isFirstInGroup && index !== 0 && !showDateSep && (
                    <div className="h-2" />
                  )}

                  <MessageRow
                    msg={msg}
                    isMe={isMe}
                    isGroup={isGroup}
                    showAvatar={isFirstInGroup}
                    showName={isFirstInGroup}
                    openUpwards={index >= messages.length - 3}
                    sessionUserId={sessionUserId}
                    onReact={onReact}
                    onReply={onReply}
                    onReplyInThread={onReplyInThread}
                    onPin={onPin}
                    onConvertToTask={onConvertToTask}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </React.Fragment>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to latest — only while the reader has scrolled away from the live
          edge, which is also when auto-follow is suppressed. */}
      <AnimatePresence>
        {!isNearBottom && messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={jumpToLatest}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-bg-secondary border border-border shadow-lg text-text-secondary hover:text-text hover:border-primary transition-colors text-[12px] font-semibold"
          >
            <ArrowDown size={14} />
            Jump to latest
          </motion.button>
        )}
      </AnimatePresence>

      {/* Typing Indicator */}
      <AnimatePresence>
        {typingUserNames.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 py-1.5 border-t border-border shrink-0 bg-bg overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <motion.span
                  className="w-1.5 h-1.5 bg-text-muted rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                />
                <motion.span
                  className="w-1.5 h-1.5 bg-text-muted rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                />
                <motion.span
                  className="w-1.5 h-1.5 bg-text-muted rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                />
              </div>
              <span className="text-[11px] text-text-muted">
                <strong>{typingUserNames.join(', ')}</strong>
                {typingUserNames.length === 1 ? ' is' : ' are'} typing…
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
