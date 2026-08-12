'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Hash, User, Briefcase, CheckCircle2, Circle, AtSign } from 'lucide-react'
import { getChatUsers, searchTasks } from '@/app/actions/chat'

interface MentionDropdownProps {
  type: 'user' | 'task' | null
  query: string
  onSelect: (item: { id: string, display: string, type: 'user' | 'task' }) => void
  onClose: () => void
  position: { bottom: number, left: number }
  /** Group channels can address everyone at once; DMs cannot. */
  allowBroadcast?: boolean
  /** `@everyone` only means anything in the General channel. */
  allowEveryone?: boolean
}

/**
 * Broadcast targets. The ids are sentinels, not user ids — the server derives
 * the audience from the `@here`/`@channel`/`@everyone` text at delivery time,
 * because who is online (and who is a member) changes after sending.
 */
const BROADCAST_ITEMS = [
  { id: '__here__',     display: 'here',     hint: 'Notify members who are online' },
  { id: '__channel__',  display: 'channel',  hint: 'Notify every member' },
  { id: '__everyone__', display: 'everyone', hint: 'Notify everyone in the org' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayFor(item: any, kind: 'user' | 'task' | null): string {
  if (item.isBroadcast) return item.display
  return kind === 'user' ? item.name : item.title
}

export function MentionDropdown({
  type, query, onSelect, onClose, position,
  allowBroadcast = false, allowEveryone = false,
}: MentionDropdownProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (!type) return

    const fetchItems = async () => {
      setLoading(true)
      try {
        if (type === 'user') {
          const q = query.toLowerCase()

          // Broadcasts first — they are what people reach for when it's urgent.
          const broadcasts = allowBroadcast
            ? BROADCAST_ITEMS
                .filter(b => allowEveryone || b.id !== '__everyone__')
                .filter(b => b.display.startsWith(q))
                .map(b => ({ ...b, isBroadcast: true }))
            : []

          const res = await getChatUsers()
          const people = res.success && res.users
            ? res.users
                .filter((u: any) => u.name.toLowerCase().includes(q))
                .slice(0, 5)
            : []

          setItems([...broadcasts, ...people])
        } else if (type === 'task') {
          const res = await searchTasks(query)
          if (res.success && res.tasks) {
            setItems(res.tasks)
          }
        }
      } catch (error) {
        console.error('Failed to fetch mentions', error)
      } finally {
        setLoading(false)
        setSelectedIndex(0)
      }
    }

    const delay = setTimeout(fetchItems, 150)
    return () => clearTimeout(delay)
  }, [type, query, allowBroadcast, allowEveryone])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!type) return
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (items[selectedIndex]) {
          const item = items[selectedIndex]
          onSelect({ id: item.id, display: displayFor(item, type), type })
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [type, items, selectedIndex, onSelect, onClose])

  if (!type) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        style={{ 
          position: 'absolute',
          bottom: position.bottom,
          left: position.left,
          marginBottom: '8px'
        }}
        className="z-[60] w-64 bg-bg border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-64"
      >
        <div className="px-3 py-2 bg-bg-secondary border-b border-border text-xs font-semibold text-text-muted flex items-center gap-2 shrink-0">
          {type === 'user' ? (
            <><User size={14} /> People matching "{query}"</>
          ) : (
            <><Hash size={14} /> Tasks matching "{query}"</>
          )}
        </div>
        
        <div className="overflow-y-auto p-1.5 flex-1">
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-text-muted" size={18} /></div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-sm text-text-muted">No results found</div>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onSelect({ id: item.id, display: displayFor(item, type), type })}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                  index === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-bg-secondary text-text'
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {item.isBroadcast ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                      <AtSign size={13} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">@{item.display}</span>
                      <span className="text-[10px] text-text-muted truncate">{item.hint}</span>
                    </div>
                  </>
                ) : type === 'user' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] shrink-0 font-medium">
                      {item.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </>
                ) : (
                  <>
                    <div className={`shrink-0 ${item.status === 'DONE' ? 'text-green-500' : 'text-text-muted'}`}>
                      {item.status === 'DONE' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      <span className="text-[10px] text-text-muted truncate flex items-center gap-1">
                        <Briefcase size={10} />
                        {item.project?.name || 'No Project'}
                      </span>
                    </div>
                  </>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
