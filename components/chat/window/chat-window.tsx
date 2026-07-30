import React from 'react'
import { ArrowLeft, Hash, MoreHorizontal, Pin, MessageSquare, Loader2, X } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { MessageBubble } from './message-bubble'
import { motion } from 'framer-motion'

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
  onReact: (msgId: string, emoji: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onOpenGroupInfo: () => void
  isMobile: boolean
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
  onReact,
  messagesEndRef,
  onOpenGroupInfo,
  isMobile
}: ChatWindowProps) {
  if (!activeConv) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center bg-bg/50 ${isMobile ? 'hidden' : 'flex'}`}>
        <div className="bg-bg-secondary p-8 rounded-2xl shadow-sm border border-border text-center max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto ">
            <MessageSquare size={32} />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Start Connecting</h2>
          <p className="text-sm text-text-muted">Select a conversation from the sidebar or start a new one to begin messaging.</p>
        </div>
      </div>
    )
  }

  const isGroup = activeConv.is_group
  const otherParticipant = !isGroup ? activeConv.participants?.find((p: any) => p.user_id !== sessionUserId)?.user : null
  const name = isGroup ? (activeConv.name || 'General') : (otherParticipant?.name || 'User')
  const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.id) : false
  const memberNames = isGroup 
    ? activeConv.participants?.map((p: any) => p.user_id === sessionUserId ? 'You' : p.user.name.split(' ')[0]).join(', ')
    : ''

  const pinnedMsg = messages.find((m: any) => m.is_pinned)

  return (
    <div className="flex-1 flex flex-col min-h-0 relative w-full h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {isMobile && (
            <button onClick={onBack} className="p-2 hover:bg-bg-tertiary rounded-full text-text-muted hover:text-text transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
          )}
          
          <div 
            className="flex items-center gap-3 overflow-hidden cursor-pointer group"
            onClick={isGroup ? onOpenGroupInfo : undefined}
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary overflow-hidden">
                {isGroup ? (
                  <Hash size={20} />
                ) : otherParticipant?.image ? (
                  <img src={otherParticipant.image} alt={name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(name)
                )}
              </div>
              {!isGroup && isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-bg-secondary rounded-full" />
              )}
            </div>
            
            <div className="flex flex-col overflow-hidden">
              <h2 className="font-semibold text-text text-[15px] truncate group-hover:underline">
                {name}
              </h2>
              <p className="text-[12px] text-text-muted truncate">
                {isGroup ? memberNames : (isOnline ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-full text-text-muted hover:text-text transition-colors"
            title="Close chat"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Pinned Message */}
      {pinnedMsg && (
        <div className="z-10 px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
          <div className="bg-bg border border-border shadow-sm rounded-md p-2 flex items-center gap-3 max-w-2xl mx-auto cursor-pointer hover:bg-bg-tertiary transition-colors">
            <div className="text-primary bg-primary/10 p-1.5 rounded-full"><Pin size={12} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary tracking-wide uppercase">Pinned</p>
              <p className="text-[12px] text-text truncate">{pinnedMsg.content}</p>
            </div>
            {pinnedMsg.sender_id === sessionUserId && (
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onPin(pinnedMsg.id, false)
                }} 
                className="text-text-muted hover:text-text p-1.5 hover:bg-bg-tertiary rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-3 py-2 md:px-4 md:py-3 relative z-10 custom-scrollbar flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="bg-bg-secondary p-4 rounded-xl border border-border shadow-sm max-w-xs">
              <p className="text-[13px] text-text-muted">Messages and calls are end-to-end encrypted. No one outside of this chat, not even AgencyOS, can read or listen to them.</p>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex flex-col pt-8">
            {messages.map((msg, index) => {
              const isMe = msg.sender_id === sessionUserId
              
              // Determine if we should show avatar/name based on grouping consecutive messages
              const prevMsg = messages[index - 1]
              const nextMsg = messages[index + 1]
              
              const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000)
              const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id || (new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000)
              
              // Margin top if it's the first message in a group to separate from previous sender
              const marginTopClass = isFirstInGroup && index !== 0 ? 'mt-4' : 'mt-0'

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  key={msg.id} 
                  className={marginTopClass}
                >
                  <MessageBubble 
                    msg={msg} 
                    isMe={isMe} 
                    isGroup={isGroup} 
                    showAvatar={isLastInGroup} // Avatar on the last message
                    showName={isFirstInGroup} // Name on the first message
                    openUpwards={index >= messages.length - 3} // Open menu upwards for the last few messages
                    sessionUserId={sessionUserId}
                    onReact={onReact}
                    onReply={onReply}
                    onPin={onPin}
                    onConvertToTask={onConvertToTask}
                  />
                </motion.div>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
