'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Bookmark, MoreHorizontal, Pin, Pencil, Trash2,
  Copy, Briefcase, SmilePlus, CheckSquare, Eye, ThumbsUp, Heart
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { EmojiPicker } from '../input/emoji-picker'

interface MessageActionBarProps {
  messageId: string
  isOwnMessage: boolean
  isPinned: boolean
  onReact: (emoji: string) => void
  onReplyInThread: () => void
  onReply: () => void
  onPin: () => void
  onEdit?: () => void
  onDelete?: () => void
  onCopyText: () => void
  onConvertToTask: () => void
  openUpwards?: boolean
  onMenuOpenChange?: (isOpen: boolean) => void
}

const QUICK_REACTIONS = [
  { emoji: '✅', label: 'Done' },
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '👀', label: 'Eyes' },
  { emoji: '❤️', label: 'Heart' },
]

export function MessageActionBar({
  messageId,
  isOwnMessage,
  isPinned,
  onReact,
  onReplyInThread,
  onReply,
  onPin,
  onEdit,
  onDelete,
  onCopyText,
  onConvertToTask,
  openUpwards = false,
  onMenuOpenChange
}: MessageActionBarProps) {
  const [showMore, setShowMore] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const emojiButtonRef = React.useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top?: number, bottom?: number, right: number }>({ right: 0 })
  const [emojiPos, setEmojiPos] = useState<{ top?: number, bottom?: number, right: number }>({ right: 0 })
  const [dropdownOpensUp, setDropdownOpensUp] = useState(false)
  const [emojiOpensUp, setEmojiOpensUp] = useState(false)

  const handleOpenMore = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Dropdown is ~260px tall.
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const shouldOpenUpwards = spaceBelow < 280 && spaceAbove > spaceBelow
      
      setDropdownOpensUp(shouldOpenUpwards)
      setDropdownPos({
        bottom: shouldOpenUpwards ? window.innerHeight - rect.top + 4 : undefined,
        top: shouldOpenUpwards ? undefined : rect.bottom + 4,
        right: window.innerWidth - rect.right
      })
    }
    const nextState = !showMore
    setShowMore(nextState)
    onMenuOpenChange?.(nextState || showEmojiPicker)
  }

  const handleOpenEmoji = () => {
    if (emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect()
      // Emoji picker is ~420px tall.
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const shouldOpenUpwards = spaceBelow < 440 && spaceAbove > spaceBelow
      
      setEmojiOpensUp(shouldOpenUpwards)
      setEmojiPos({
        bottom: shouldOpenUpwards ? window.innerHeight - rect.top + 4 : undefined,
        top: shouldOpenUpwards ? undefined : rect.bottom + 4,
        right: window.innerWidth - rect.right
      })
    }
    const nextState = !showEmojiPicker
    setShowEmojiPicker(nextState)
    onMenuOpenChange?.(showMore || nextState)
  }

  // Hide popups on scroll
  React.useEffect(() => {
    if (showMore || showEmojiPicker) {
      let isActive = false
      const timer = setTimeout(() => { isActive = true }, 150)
      const handleScroll = (e: Event) => {
        if (!isActive) return
        
        // Ignore scroll events originating from inside the portal itself
        const target = e.target as HTMLElement
        if (target && (target.closest('.emoji-picker-container') || target.closest('.more-options-container'))) {
          return
        }

        setShowMore(false)
        setShowEmojiPicker(false)
        onMenuOpenChange?.(false)
      }
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [showMore, showEmojiPicker, onMenuOpenChange])

  return (
    <div className="absolute -top-4 right-2 z-30">
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="flex items-center gap-0.5 bg-bg border border-border rounded-lg shadow-lg p-0.5"
      >
        {/* Quick Reactions */}
        {QUICK_REACTIONS.map(r => (
          <button
            key={r.emoji}
            onClick={() => onReact(r.emoji)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-colors text-base active:scale-90"
            title={r.label}
          >
            {r.emoji}
          </button>
        ))}

        {/* Emoji Picker Trigger */}
        <div className="relative">
          <button
            ref={emojiButtonRef}
            onClick={handleOpenEmoji}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text"
            title="Add reaction"
          >
            <SmilePlus size={16} />
          </button>
          {typeof window !== 'undefined' && createPortal(
            <AnimatePresence>
              {showEmojiPicker && (
                <div
                  className="emoji-picker-container"
                  style={{
                    position: 'fixed',
                    top: emojiPos.top,
                    bottom: emojiPos.bottom,
                    right: emojiPos.right,
                    zIndex: 110,
                  }}
                >
                <EmojiPicker
                  onSelect={(emoji) => {
                    onReact(emoji)
                    setShowEmojiPicker(false)
                    onMenuOpenChange?.(false)
                  }}
                  onClose={() => {
                    setShowEmojiPicker(false)
                    onMenuOpenChange?.(false)
                  }}
                  position={emojiOpensUp ? 'bottom' : 'top'}
                  isPortaled={true}
                />
                </div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Reply in Thread */}
        <button
          onClick={onReplyInThread}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text"
          title="Reply in thread"
        >
          <MessageSquare size={16} />
        </button>

        {/* More Options */}
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={handleOpenMore}
            className={`w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text ${showMore ? 'bg-bg-tertiary text-text' : ''}`}
            title="More actions"
          >
            <MoreHorizontal size={16} />
          </button>

          {typeof window !== 'undefined' && createPortal(
            <AnimatePresence>
              {showMore && (
                <>
                  <div
                    className="fixed inset-0 z-[100]"
                    onClick={() => { setShowMore(false); onMenuOpenChange?.(false); }}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: dropdownOpensUp ? 4 : -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: dropdownOpensUp ? 4 : -4 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'fixed',
                      top: dropdownPos.top,
                      bottom: dropdownPos.bottom,
                      right: dropdownPos.right,
                    }}
                    className="more-options-container w-52 bg-bg border border-border-muted rounded-xl shadow-2xl z-[110] overflow-hidden py-1"
                  >
                  <button
                    onClick={() => { onReply(); setShowMore(false); onMenuOpenChange?.(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-text hover:bg-bg-tertiary transition-colors flex items-center gap-2.5"
                  >
                    <MessageSquare size={15} className="text-text-muted" /> Reply inline
                  </button>
                  {isOwnMessage && onEdit && (
                    <button
                      onClick={() => { onEdit(); setShowMore(false); onMenuOpenChange?.(false); }}
                      className="w-full text-left px-3 py-2 text-[13px] text-text hover:bg-bg-tertiary transition-colors flex items-center gap-2.5"
                    >
                      <Pencil size={15} className="text-text-muted" /> Edit message
                    </button>
                  )}
                  <button
                    onClick={() => { onPin(); setShowMore(false); onMenuOpenChange?.(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-text hover:bg-bg-tertiary transition-colors flex items-center gap-2.5"
                  >
                    <Pin size={15} className="text-text-muted" /> {isPinned ? 'Unpin message' : 'Pin message'}
                  </button>
                  <button
                    onClick={() => { onCopyText(); setShowMore(false); onMenuOpenChange?.(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-text hover:bg-bg-tertiary transition-colors flex items-center gap-2.5"
                  >
                    <Copy size={15} className="text-text-muted" /> Copy text
                  </button>
                  <button
                    onClick={() => { onConvertToTask(); setShowMore(false); onMenuOpenChange?.(false); }}
                    className="w-full text-left px-3 py-2 text-[13px] text-text hover:bg-bg-tertiary transition-colors flex items-center gap-2.5"
                  >
                    <Briefcase size={15} className="text-text-muted" /> Convert to task
                  </button>

                  {isOwnMessage && onDelete && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <button
                        onClick={() => { onDelete(); setShowMore(false); onMenuOpenChange?.(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-danger hover:bg-danger/5 transition-colors flex items-center gap-2.5"
                      >
                        <Trash2 size={15} /> Delete message
                      </button>
                    </>
                  )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>
      </motion.div>
    </div>
  )
}
