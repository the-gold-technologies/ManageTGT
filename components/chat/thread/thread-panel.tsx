'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Hash } from 'lucide-react'
import { MessageRow } from '../window/message-row'
import { RichMessageInput } from '../input/rich-message-input'

interface ThreadPanelProps {
  parentMessage: any
  replies: any[]
  isLoading: boolean
  sessionUserId?: string
  channelName?: string
  onClose: () => void
  onSendReply: (html: string, plainText: string, alsoSendToChannel: boolean) => void
  onReact: (msgId: string, emoji: string) => void
  onPin: (msgId: string, isPinned: boolean) => void
  onConvertToTask: (content: string) => void
  onEdit?: (msgId: string, content: string) => void
  onDelete?: (msgId: string) => void
  // File handling
  isUploading: boolean
  pendingFile: any
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  setPendingFile: (file: any) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export function ThreadPanel({
  parentMessage,
  replies,
  isLoading,
  sessionUserId,
  channelName,
  onClose,
  onSendReply,
  onReact,
  onPin,
  onConvertToTask,
  onEdit,
  onDelete,
  isUploading,
  pendingFile,
  handleFileSelect,
  setPendingFile,
  fileInputRef
}: ThreadPanelProps) {
  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new replies
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies])

  const uniqueRepliers = new Map<string, any>()
  replies.forEach(r => {
    if (r.sender && !uniqueRepliers.has(r.sender_id)) {
      uniqueRepliers.set(r.sender_id, r.sender)
    }
  })

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute top-0 right-0 bottom-0 w-[380px] bg-bg border-l border-border z-[50] shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-text text-[15px]">Thread</h3>
          {channelName && (
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Hash size={11} />
              {channelName}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Parent Message */}
      <div className="border-b border-border bg-bg shrink-0">
        <MessageRow
          msg={parentMessage}
          isMe={parentMessage.sender_id === sessionUserId}
          isGroup={true}
          showAvatar={true}
          showName={true}
          sessionUserId={sessionUserId}
          onReact={onReact}
          onPin={onPin}
          onConvertToTask={onConvertToTask}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Reply Count Bar */}
      <div className="px-4 py-2 border-b border-border bg-bg/50 shrink-0 flex items-center gap-3">
        <div className="flex -space-x-1.5">
          {Array.from(uniqueRepliers.values()).slice(0, 5).map((user, idx) => (
            <div
              key={idx}
              className="w-5 h-5 rounded-md border-2 border-bg bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold overflow-hidden"
            >
              {user.image ? (
                <img src={user.image} alt="" className="w-full h-full object-cover" />
              ) : (
                (user.name || 'U').substring(0, 2).toUpperCase()
              )}
            </div>
          ))}
        </div>
        <span className="text-[12px] font-semibold text-primary">
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Replies List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="text-[13px] text-text-muted">No replies yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="py-2">
            {replies.map((reply, index) => {
              const prevReply = replies[index - 1]
              const isFirstInGroup = !prevReply ||
                prevReply.sender_id !== reply.sender_id ||
                (new Date(reply.createdAt).getTime() - new Date(prevReply.createdAt).getTime() > 5 * 60 * 1000)

              return (
                <MessageRow
                  key={reply.id}
                  msg={reply}
                  isMe={reply.sender_id === sessionUserId}
                  isGroup={true}
                  showAvatar={isFirstInGroup}
                  showName={isFirstInGroup}
                  sessionUserId={sessionUserId}
                  onReact={onReact}
                  onPin={onPin}
                  onConvertToTask={onConvertToTask}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  openUpwards={index >= replies.length - 2}
                />
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="shrink-0 border-t border-border">
        {/* Also send to channel checkbox */}
        <div className="px-4 py-2 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoSendToChannel}
              onChange={(e) => setAlsoSendToChannel(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
            />
            <span className="text-[12px] text-text-muted">
              Also send to{' '}
              <span className="font-semibold text-text">#{channelName || 'channel'}</span>
            </span>
          </label>
        </div>

        <RichMessageInput
          onSend={(html, plainText) => onSendReply(html, plainText, alsoSendToChannel)}
          channelName={`thread`}
          isUploading={isUploading}
          pendingFile={pendingFile}
          handleFileSelect={handleFileSelect}
          setPendingFile={setPendingFile}
          fileInputRef={fileInputRef}
          replyingToMsg={null}
          onCancelReply={() => {}}
        />
      </div>
    </motion.div>
  )
}
