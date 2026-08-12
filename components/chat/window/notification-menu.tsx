'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, AtSign, Check, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getConversationNotifySettings,
  setConversationNotifyLevel,
  muteConversation,
  type ChatNotifyLevel,
} from '@/app/actions/chat'

interface NotificationMenuProps {
  conversationId: string
  isGroup: boolean
  onChanged?: () => void
}

const LEVELS: { id: ChatNotifyLevel; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'ALL',
    label: 'Every message',
    hint: 'Notify me whenever anyone posts',
    icon: <Bell size={14} />,
  },
  {
    id: 'MENTIONS',
    label: 'Mentions only',
    hint: 'Only when I am named, or @channel is used',
    icon: <AtSign size={14} />,
  },
  {
    id: 'NONE',
    label: 'Nothing',
    hint: 'Still shows unread, never notifies',
    icon: <BellOff size={14} />,
  },
]

const MUTE_DURATIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '8 hours', minutes: 60 * 8 },
  { label: '24 hours', minutes: 60 * 24 },
]

export function NotificationMenu({ conversationId, isGroup, onChanged }: NotificationMenuProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [level, setLevel] = useState<ChatNotifyLevel>('MENTIONS')
  const [mutedUntil, setMutedUntil] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isMuted = level === 'NONE' || (mutedUntil !== null && mutedUntil > new Date())

  // Read the current setting only when the menu is actually opened.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    setLoading(true)
    getConversationNotifySettings(conversationId)
      .then(res => {
        if (cancelled || !res.success) return
        setLevel(res.level ?? 'MENTIONS')
        setMutedUntil(res.mutedUntil ? new Date(res.mutedUntil) : null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [open, conversationId])

  // Dismiss on outside click and on Escape.
  useEffect(() => {
    if (!open) return

    const handlePointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const applyLevel = async (next: ChatNotifyLevel) => {
    setSaving(true)
    const res = await setConversationNotifyLevel(conversationId, next)
    setSaving(false)

    if (!res.success) {
      toast.error(res.error || 'Could not change notifications')
      return
    }
    setLevel(next)
    toast.success(
      next === 'ALL' ? 'Notifying on every message'
        : next === 'MENTIONS' ? 'Notifying on mentions only'
          : 'Notifications off for this conversation'
    )
    onChanged?.()
    setOpen(false)
  }

  const applyMute = async (minutes: number | null) => {
    setSaving(true)
    const res = await muteConversation(conversationId, minutes)
    setSaving(false)

    if (!res.success) {
      toast.error(res.error || 'Could not update mute')
      return
    }
    setMutedUntil(res.mutedUntil ? new Date(res.mutedUntil) : null)
    toast.success(minutes === null ? 'Unmuted' : 'Muted')
    onChanged?.()
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-lg transition-colors ${
          open
            ? 'bg-primary/10 text-primary'
            : isMuted
              ? 'text-text-muted hover:bg-bg-tertiary hover:text-text'
              : 'text-text-muted hover:bg-bg-tertiary hover:text-text'
        }`}
        title={isMuted ? 'Notifications muted' : 'Notification settings'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            role="menu"
            className="absolute right-0 top-full mt-2 w-72 bg-bg border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border bg-bg-secondary flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Notify me about
              </span>
              {(loading || saving) && <Loader2 size={12} className="animate-spin text-text-muted" />}
            </div>

            <div className="p-1.5">
              {LEVELS.map(option => {
                // "Every message" is the only sensible setting for a DM, so the
                // choice is not offered there.
                if (!isGroup && option.id === 'MENTIONS') return null
                const selected = level === option.id

                return (
                  <button
                    key={option.id}
                    role="menuitemradio"
                    aria-checked={selected}
                    disabled={saving}
                    onClick={() => applyLevel(option.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition-colors disabled:opacity-50 ${
                      selected ? 'bg-primary/10 text-primary' : 'hover:bg-bg-secondary text-text'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{option.icon}</span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-medium">{option.label}</span>
                      <span className="text-[11px] text-text-muted leading-snug">{option.hint}</span>
                    </span>
                    {selected && <Check size={14} className="shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>

            <div className="px-3 py-2 border-t border-border bg-bg-secondary">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {mutedUntil && mutedUntil > new Date() ? 'Muted' : 'Mute for a while'}
              </span>
            </div>

            <div className="p-1.5">
              {mutedUntil && mutedUntil > new Date() ? (
                <>
                  <div className="px-2.5 py-1.5 text-[12px] text-text-muted flex items-center gap-2">
                    <Clock size={12} />
                    Until {mutedUntil.toLocaleString([], {
                      weekday: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </div>
                  <button
                    disabled={saving}
                    onClick={() => applyMute(null)}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-[13px] font-medium hover:bg-bg-secondary text-text transition-colors disabled:opacity-50"
                  >
                    Unmute now
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {MUTE_DURATIONS.map(d => (
                    <button
                      key={d.minutes}
                      disabled={saving}
                      onClick={() => applyMute(d.minutes)}
                      className="px-2.5 py-2 rounded-lg text-[12px] font-medium hover:bg-bg-secondary text-text-secondary hover:text-text transition-colors text-left disabled:opacity-50"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
