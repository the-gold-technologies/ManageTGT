'use client'

import React, { useState } from 'react'
import { getInitials } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, ChevronRight } from 'lucide-react'
import { MessageActionBar } from './message-action-bar'

interface MessageRowProps {
  msg: any
  isMe: boolean
  isGroup: boolean
  showAvatar: boolean
  showName: boolean
  openUpwards?: boolean
  sessionUserId?: string
  onReact?: (msgId: string, emoji: string) => void
  onReply?: (msgId: string) => void
  onReplyInThread?: (msgId: string) => void
  onPin?: (msgId: string, isPinned: boolean) => void
  onConvertToTask?: (content: string) => void
  onEdit?: (msgId: string, content: string) => void
  onDelete?: (msgId: string) => void
}

export function MessageRow({
  msg,
  isMe,
  isGroup,
  showAvatar,
  showName,
  openUpwards,
  sessionUserId,
  onReact,
  onReply,
  onReplyInThread,
  onPin,
  onConvertToTask,
  onEdit,
  onDelete
}: MessageRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateString = new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })

  // Render rich HTML content or plain text
  const renderContent = (content: string) => {
    if (!content) return null

    // Check for Jumbo Emoji (1 to 3 emojis, no other text)
    const text = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (text.length > 0 && text.length <= 20) {
      try {
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
        const graphemes = Array.from(segmenter.segment(text)).map(s => s.segment).filter(g => g.trim() !== '')
        if (graphemes.length > 0 && graphemes.length <= 3) {
          // Check if every visible grapheme is an emoji
          const isAllEmoji = graphemes.every(g => /\p{Extended_Pictographic}/u.test(g))
          if (isAllEmoji) {
            const sizeClass = graphemes.length === 1 ? 'text-[3rem]' : graphemes.length === 2 ? 'text-[2.5rem]' : 'text-[2rem]'
            return <div className={`${sizeClass} leading-tight py-1 select-text`}>{text}</div>
          }
        }
      } catch (e) {
        // Fallback if Intl.Segmenter is not available, just continue to normal rendering
      }
    }

    // Check if content is HTML (from Tiptap)
    if (content.startsWith('<') && (content.includes('<p>') || content.includes('<h') || content.includes('<ul') || content.includes('<ol') || content.includes('<blockquote') || content.includes('<pre'))) {
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none
            [&_p]:my-0 [&_p]:leading-relaxed
            [&_strong]:font-semibold
            [&_em]:italic
            [&_s]:line-through
            [&_code]:bg-bg-tertiary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono [&_code]:text-pink-500 dark:[&_code]:text-pink-400
            [&_pre]:bg-[#1e1e2e] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-1.5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[12px] [&_pre_code]:text-emerald-300
            [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc
            [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal
            [&_li]:my-0
            [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:my-1.5 [&_blockquote]:italic [&_blockquote]:text-text-muted
            [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 hover:[&_a]:decoration-primary
            [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-1
            [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-1
            [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )
    }

    // Legacy plain text rendering with mention support
    const parts = content.split(/([@#]\[[^\]]+\]\([^)]+\))/g)

    return (
      <div className="whitespace-pre-wrap break-words leading-relaxed">
        {parts.map((part, i) => {
          const mentionMatch = part.match(/([@#])\[([^\]]+)\]\(([^)]+)\)/)
          if (mentionMatch) {
            const type = mentionMatch[1]
            const display = mentionMatch[2]
            return (
              <span
                key={i}
                className="inline-flex items-center gap-0.5 bg-primary/10 text-primary px-1.5 py-0.5 mx-0.5 rounded text-[12px] font-semibold cursor-pointer hover:bg-primary/20 transition-colors"
              >
                {type === '@' ? '@' : '#'}{display}
              </span>
            )
          }

          // Bold markdown
          const boldParts = part.split(/(\*\*.*?\*\*)/g)
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
        })}
      </div>
    )
  }

  // Deleted message placeholder
  if (msg.is_deleted) {
    return (
      <div className="flex items-start gap-3 px-5 py-1 group">
        <div className="w-9 h-9 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-muted italic">This message was deleted</p>
        </div>
      </div>
    )
  }

  // Compact row (continuation of same sender)
  if (!showName && !showAvatar) {
    return (
      <div
        className="relative flex items-start gap-3 px-5 py-[1px] group hover:bg-bg-secondary/50 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Hover timestamp */}
        <div className="w-9 shrink-0 flex items-center justify-center pt-0.5">
          <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity font-mono select-none whitespace-nowrap tracking-tighter">
            {timeString}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 text-[14px] text-text">
          {renderContent(msg.content)}

          {/* Attachment */}
          {msg.attachment_url && renderAttachment(msg.attachment_url, msg.content)}
        </div>

        {/* Action Bar */}
        <AnimatePresence>
          {(isHovered || isMenuOpen) && (
            <MessageActionBar
              messageId={msg.id}
              isOwnMessage={isMe}
              isPinned={msg.is_pinned}
              onReact={(emoji) => onReact?.(msg.id, emoji)}
              onReply={() => onReply?.(msg.id)}
              onReplyInThread={() => onReplyInThread?.(msg.id)}
              onPin={() => onPin?.(msg.id, !msg.is_pinned)}
              onEdit={isMe ? () => onEdit?.(msg.id, msg.content) : undefined}
              onDelete={isMe ? () => onDelete?.(msg.id) : undefined}
              onCopyText={() => navigator.clipboard.writeText(msg.content?.replace(/<[^>]*>/g, '') || '')}
              onConvertToTask={() => onConvertToTask?.(msg.content)}
              openUpwards={openUpwards}
              onMenuOpenChange={setIsMenuOpen}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Full row (with avatar + name)
  return (
    <div
      className="relative flex items-start gap-3 px-5 py-2 group hover:bg-bg-secondary/50 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold overflow-hidden bg-primary/10 text-primary mt-0.5">
        {msg.sender?.image ? (
          <img src={msg.sender.image} alt={msg.sender?.name} className="w-full h-full object-cover" />
        ) : (
          getInitials(msg.sender?.name || 'User')
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {/* Name + Time */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[14px] font-bold text-text hover:underline cursor-pointer">
            {msg.sender?.name || 'User'}
          </span>
          <span className="text-[11px] text-text-muted font-normal">
            {timeString}
          </span>
          {msg.is_edited && (
            <span className="text-[10px] text-text-muted">(edited)</span>
          )}
        </div>

        {/* Reply-to Preview */}
        {msg.reply_to && !msg.reply_to.is_deleted && (
          <div className="mb-1.5 flex items-center gap-2 pl-3 border-l-2 border-primary/30">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-text-muted">
                {msg.reply_to.sender?.name || 'User'}
              </span>
              <p className="text-[12px] text-text-muted truncate leading-snug">
                {msg.reply_to.content?.replace(/<[^>]*>/g, '').substring(0, 120)}
              </p>
            </div>
          </div>
        )}

        {/* Message Content */}
        <div className="text-[14px] text-text">
          {renderContent(msg.content)}
        </div>

        {/* Attachment */}
        {msg.attachment_url && renderAttachment(msg.attachment_url, msg.content)}

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <AnimatePresence>
              {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => {
                const isSelected = (users as string[]).includes(sessionUserId || '')
                return (
                  <motion.button
                    key={emoji}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={() => onReact?.(msg.id, emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-[#E06A26]/30 text-primary hover:bg-primary/15'
                        : 'bg-bg border-transparent hover:border-border text-text hover:bg-bg-tertiary'
                    }`}
                  >
                    <span className="text-sm">{emoji}</span>
                    <span className="font-medium text-[11px]">{users.length}</span>
                  </motion.button>
                )
              })}
            </AnimatePresence>
            {/* Add reaction button */}
            <button
              onClick={() => {/* Will be handled by action bar */}}
              className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary hover:border-border transition-colors opacity-0 group-hover:opacity-100"
            >
              <span className="text-xs">+</span>
            </button>
          </div>
        )}

        {/* Thread Replies Preview */}
        {msg.replies && msg.replies.length > 0 && (
          <button
            onClick={() => onReplyInThread?.(msg.id)}
            className="mt-1.5 flex items-center gap-2 text-primary hover:underline group/thread"
          >
            {/* Stacked avatars of thread participants */}
            <div className="flex -space-x-1.5">
              {msg.replies.slice(0, 3).map((reply: any, idx: number) => (
                <div
                  key={idx}
                  className="w-5 h-5 rounded-full border-2 border-bg bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold overflow-hidden"
                >
                  {reply.sender?.image ? (
                    <img src={reply.sender.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(reply.sender?.name || 'U')
                  )}
                </div>
              ))}
            </div>
            <span className="text-[12px] font-semibold">
              {msg.replies.length} {msg.replies.length === 1 ? 'reply' : 'replies'}
            </span>
            <ChevronRight size={14} className="opacity-0 group-hover/thread:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Action Bar on Hover */}
      <AnimatePresence>
        {(isHovered || isMenuOpen) && (
          <MessageActionBar
            messageId={msg.id}
            isOwnMessage={isMe}
            isPinned={msg.is_pinned}
            onReact={(emoji) => onReact?.(msg.id, emoji)}
            onReply={() => onReply?.(msg.id)}
            onReplyInThread={() => onReplyInThread?.(msg.id)}
            onPin={() => onPin?.(msg.id, !msg.is_pinned)}
            onEdit={isMe ? () => onEdit?.(msg.id, msg.content) : undefined}
            onDelete={isMe ? () => onDelete?.(msg.id) : undefined}
            onCopyText={() => navigator.clipboard.writeText(msg.content?.replace(/<[^>]*>/g, '') || '')}
            onConvertToTask={() => onConvertToTask?.(msg.content)}
            openUpwards={openUpwards}
            onMenuOpenChange={setIsMenuOpen}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Attachment renderer
function renderAttachment(url: string, content?: string) {
  const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)
  const isPdf = url.match(/\.pdf$/i)

  if (isImage) {
    return (
      <div className="mt-1.5 rounded-lg overflow-hidden border border-border max-w-sm bg-bg-tertiary">
        <img
          src={url}
          alt="attachment"
          className="max-w-full h-auto max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(url, '_blank')}
        />
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 flex items-center gap-3 p-3 rounded-lg border border-border bg-bg hover:bg-bg-tertiary transition-colors max-w-sm group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text truncate group-hover:underline">
          {content || url.split('/').pop() || 'Download File'}
        </p>
        <p className="text-[11px] text-text-muted">Click to open</p>
      </div>
    </a>
  )
}
