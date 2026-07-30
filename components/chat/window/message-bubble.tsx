import React, { useState } from 'react'
import { Check, CheckCheck, ChevronDown, Reply, Smile, MoreHorizontal, Pin, Briefcase } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface MessageBubbleProps {
  msg: any
  isMe: boolean
  isGroup: boolean
  showAvatar: boolean
  showName: boolean
  openUpwards?: boolean
  sessionUserId?: string
  onReact?: (msgId: string, emoji: string) => void
  onReply?: (msgId: string) => void
  onPin?: (msgId: string, isPinned: boolean) => void
  onConvertToTask?: (content: string) => void
}

const ANIMATED_EMOJIS = [
  { char: '👍', hex: '1f44d' },
  { char: '❤️', hex: '2764' },
  { char: '😂', hex: '1f602' },
  { char: '😮', hex: '1f62e' },
  { char: '😢', hex: '1f622' },
  { char: '🙏', hex: '1f64f' }
]

export function MessageBubble({ msg, isMe, isGroup, showAvatar, showName, openUpwards, sessionUserId, onReact, onReply, onPin, onConvertToTask }: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  
  const renderMessageContent = (content: string) => {
    if (!content) return null
    const parts = content.split(/([@#]\[[^\]]+\]\([^)]+\))/g)
    
    return parts.map((part, i) => {
      const mentionMatch = part.match(/([@#])\[([^\]]+)\]\(([^)]+)\)/)
      if (mentionMatch) {
        const type = mentionMatch[1]
        const display = mentionMatch[2]
        return (
          <span key={i} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
            isMe ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
          }`}>
            {type === '@' ? '@' : '#'}
            {display}
          </span>
        )
      }
      
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
    })
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full group mb-0.5 relative`}>
      <div className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} relative max-w-[85%] md:max-w-[70%]`}>
        
        {/* Avatar for incoming messages in a group */}
        {!isMe && isGroup && (
          <div className="w-7 h-7 min-w-[28px] rounded-full shrink-0 flex items-center justify-center font-medium text-[10px] overflow-hidden bg-primary  text-white">
            {showAvatar ? (
              msg.sender?.image ? (
                <img src={msg.sender.image} alt={msg.sender.name} className="w-full h-full object-cover" />
              ) : (
                getInitials(msg.sender?.name || 'User')
              )
            ) : (
              <div className="w-7 h-7 min-w-[28px]" />
            )}
          </div>
        )}

        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} min-w-0 relative`}>
          
          {/* Sender Name for group chats */}
          {!isMe && isGroup && showName && (
            <span className="text-[11px] font-semibold text-text-muted ml-1 mb-0.5">
              {msg.sender?.name}
            </span>
          )}

          {/* Replied Message Preview */}
          {msg.reply_to && (
            <div className={`mb-1 p-2 rounded-lg text-xs border-l-4 cursor-pointer ${
              isMe ? 'bg-white/25 border-white text-white' : 'bg-black/20 border-primary text-text'
            } max-w-full overflow-hidden`}>
              <span className={`font-bold block mb-0.5 text-[11px] ${isMe ? 'text-white' : 'text-primary'}`}>
                {msg.reply_to.sender?.name || 'User'}
              </span>
              <p className="line-clamp-2 opacity-90 leading-relaxed">{renderMessageContent(msg.reply_to.content)}</p>
            </div>
          )}

          {/* Bubble */}
          <div className={`relative px-2.5 py-1 text-[13px] leading-relaxed shadow-sm flex flex-col group/bubble ${
            isMe 
              ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm' 
              : 'bg-bg-secondary text-text border border-border rounded-2xl rounded-tl-sm'
          } ${msg.reactions && Object.keys(msg.reactions).length > 0 ? 'mb-5' : ''}`}>
            
            {/* WhatsApp-Style Top Right Arrow */}
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className={`absolute top-1 right-1 p-0.5 rounded-full opacity-0 group-hover/bubble:opacity-100 transition-all outline-none z-10 shadow-sm ${
                isMe 
                  ? 'bg-white text-primary hover:bg-white/90' 
                  : 'bg-bg text-text-muted hover:text-text hover:bg-bg-tertiary'
              }`}
            >
              <ChevronDown size={18} className="drop-shadow-sm" />
            </button>

            {/* Attachment */}
            {msg.attachment_url && (
              <div className="mb-2 mt-1 rounded-lg overflow-hidden border border-black/10">
                {msg.attachment_url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                  <img src={msg.attachment_url} alt="attachment" className="max-w-full h-auto max-h-60 object-contain" />
                ) : (
                  <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-black/5 hover:bg-black/10 transition-colors">
                    <span className="truncate underline">{msg.content || 'Download File'}</span>
                  </a>
                )}
              </div>
            )}

            {/* Content & Metadata container */}
            <div className="relative flex flex-col min-w-[60px] pr-6">
              <div className="whitespace-pre-wrap break-words pb-[2px] leading-relaxed">
                {renderMessageContent(msg.content)}
                <span className="inline-block w-14" /> {/* Spacer for timestamp */}
              </div>
              
              <div className="absolute bottom-0 right-0 flex items-center gap-1 shrink-0 pb-0.5">
                {msg.is_edited && <span className="text-[10px] opacity-60">Edited</span>}
                <span className={`text-[10px] leading-none ${isMe ? 'text-primary-foreground/70' : 'text-text-muted'}`}>
                  {timeString}
                </span>
                {isMe && (
                  <span className="text-primary-foreground/80 flex items-center">
                    {msg.status === 'read' ? <CheckCheck size={14} className="text-blue-300" /> : <Check size={14} />}
                  </span>
                )}
              </div>
            </div>

            {/* Reactions (Floats on bottom edge) */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className={`absolute -bottom-5 ${isMe ? 'right-2' : 'left-2'} flex flex-wrap gap-1 z-10`}>
                <AnimatePresence>
                  {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                    <motion.button 
                      key={emoji} 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => onReact?.(msg.id, emoji)}
                      className={`rounded-full px-2 py-0.5 text-[12px] shadow-sm flex items-center gap-1 transition-colors ${
                        (users as string[]).includes(sessionUserId || '') 
                          ? 'bg-bg text-primary' 
                          : 'bg-bg hover:bg-bg-tertiary text-text'
                      }`}
                    >
                      <span>{emoji}</span>
                      {users.length > 1 && (
                        <span className={((users as string[]).includes(sessionUserId || '')) ? 'text-primary' : 'text-text-muted'}>{users.length}</span>
                      )}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {menuOpen && (
            <>
              {/* Invisible Backdrop to handle click outside */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                }} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 5 : -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 5 : -5 }}
                transition={{ duration: 0.1 }}
                className={`absolute ${openUpwards ? 'bottom-8 origin-bottom' : 'top-8 origin-top'} ${isMe ? 'right-0' : 'left-8'} w-64 bg-bg-secondary border border-border shadow-xl rounded-xl z-50 flex flex-col overflow-hidden`}
              >
                {/* Emojis Pill */}
                <div className="flex items-center justify-between p-2 bg-bg border-b border-border">
                  {ANIMATED_EMOJIS.map((e) => (
                    <button
                      key={e.char}
                      onClick={() => { onReact?.(msg.id, e.char); setMenuOpen(false) }}
                      className="p-1 hover:bg-bg-secondary rounded-full transition-transform hover:scale-110 active:scale-95"
                    >
                      <img src={`https://fonts.gstatic.com/s/e/notoemoji/latest/${e.hex}/512.webp`} alt={e.char} className="w-6 h-6 object-contain" />
                    </button>
                  ))}
                </div>

                {/* Actions List */}
                <div className="py-1 flex flex-col">
                  <button
                    onClick={() => { onReply?.(msg.id); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg transition-colors flex items-center gap-3"
                  >
                    <Reply size={16} className="text-text-muted" /> Reply
                  </button>
                  <button
                    onClick={() => { onPin?.(msg.id, !msg.is_pinned); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg transition-colors flex items-center gap-3"
                  >
                    <Pin size={16} className="text-text-muted" /> {msg.is_pinned ? "Unpin Message" : "Pin Message"}
                  </button>
                  <button
                    onClick={() => { onConvertToTask?.(msg.content); setMenuOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg transition-colors flex items-center gap-3"
                  >
                    <Briefcase size={16} className="text-text-muted" /> Convert to Task
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
