import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Hash, MessageSquare, Loader2, BellOff } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface ChatSidebarProps {
  conversations: any[]
  users: any[]
  activeConvId: string | null
  setActiveConvId: (id: string | null) => void
  onlineUsers: Set<string>
  sessionUserId?: string
  isLoading: boolean
  onClose: () => void
  isMobile: boolean
  onOpenCreateChannel?: () => void
  onStartDM?: (userId: string) => void
}

export function ChatSidebar({
  conversations = [],
  users = [],
  activeConvId,
  setActiveConvId,
  onlineUsers,
  sessionUserId,
  isLoading,
  onClose,
  isMobile,
  onOpenCreateChannel,
  onStartDM
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'channels' | 'dms'>('all')

  // Muted conversations are excluded: the point of muting is that they stop
  // demanding attention, so they must not inflate the unread filter either.
  const totalUnreadConversations = conversations.filter(
    c => (c.unreadCount || 0) > 0 && !c.isMuted
  ).length

  const filteredConversations = conversations.filter(c => {
    // Basic search
    const searchMatch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.participants?.some((p: any) => p.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (!searchMatch) return false

    if (filter === 'channels') return c.is_group
    if (filter === 'dms') return !c.is_group
    if (filter === 'unread') return (c.unreadCount || 0) > 0 && !c.isMuted
    return true
  })

  const usersWithoutDM = users.filter(u => {
    const hasDM = conversations.some(c => !c.is_group && c.participants.some((p: any) => p.user_id === u.id))
    return !hasDM
  })

  const filteredUsersWithoutDM = usersWithoutDM.filter(u => {
    if (!searchQuery) return true
    return u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const renderConversationItem = (conv: any) => {
    const isGroup = conv.is_group
    const otherParticipant = !isGroup ? conv.participants.find((p: any) => p.user_id !== sessionUserId)?.user : null
    const name = isGroup ? (conv.name || 'General') : (otherParticipant?.name || 'User')
    const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.id) : false
    const isActive = activeConvId === conv.id

    // Unread and mentions are different signals, so they get different weight:
    // a direct message counts every message, a channel only badges when you were
    // actually named. Otherwise a busy channel reads as urgent when it isn't.
    const unread = conv.unreadCount || 0
    const mentions = conv.mentionCount || 0
    const isMuted = !!conv.isMuted
    const badgeCount = isGroup ? mentions : unread
    // Muted conversations still show unread state, they just never shout.
    const showBold = unread > 0 && !isMuted
    const showBadge = badgeCount > 0

    return (
      <motion.button
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        key={conv.id}
        onClick={() => setActiveConvId(conv.id)}
        className={`w-full flex items-center gap-2.5 pr-2.5 pl-6 py-1.5 rounded-lg transition-all text-left group ${
          isActive ? 'bg-bg-tertiary shadow-sm' : 'hover:bg-bg-secondary'
        }`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-medium text-[11px] overflow-hidden ${
            isActive ? 'bg-primary/20 text-primary' : 'bg-bg-secondary text-text-secondary group-hover:bg-bg-tertiary'
          }`}>
            {isGroup ? (
              <Hash size={14} />
            ) : otherParticipant?.image ? (
              <img src={otherParticipant.image} alt={name} className="w-full h-full object-cover" />
            ) : (
              getInitials(name)
            )}
          </div>
          {!isGroup && isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-bg rounded-full z-10" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <h3 className={`text-[13px] truncate ${
            isActive
              ? 'text-text font-medium'
              : showBold
                ? 'text-text font-semibold'
                : isMuted
                  ? 'text-text-muted font-medium'
                  : 'text-text-secondary font-medium'
          }`}>
            {name} {(!isGroup && otherParticipant?.id === sessionUserId) && <span className="text-text-muted font-normal ml-1">(you)</span>}
          </h3>

          <div className="flex items-center gap-1 shrink-0">
            {isMuted && (
              <span title="Notifications muted" className="text-text-muted flex items-center">
                <BellOff size={11} />
              </span>
            )}
            {showBadge && (
              <div className={`min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold ${
                isMuted ? 'bg-bg-tertiary text-text-muted' : 'bg-primary text-white'
              }`}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </div>
            )}
          </div>
        </div>
      </motion.button>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-bg border-r border-border transition-all duration-300 ${isMobile && activeConvId ? 'hidden' : 'w-full md:w-[320px] shrink-0'}`}>
      {/* Header */}
      <div className="py-3 px-3 border-b border-border bg-bg-secondary sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text tracking-tight">Chats</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={onOpenCreateChannel}
              className="p-2 bg-primary text-white hover:bg-primary-hover rounded-full transition-colors shadow-glow-sm"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border focus:border-primary focus:ring-0 focus:ring-offset-0 focus:shadow-none rounded-full pl-9 pr-4 py-2 text-sm text-text transition-all outline-none focus:outline-none shadow-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: 'All', icon: null },
            // The 'unread' branch already existed in the filter logic but had no
            // control to reach it.
            {
              id: 'unread',
              label: totalUnreadConversations > 0 ? `Unread (${totalUnreadConversations})` : 'Unread',
              icon: null,
            },
            { id: 'channels', label: 'Channels', icon: <Hash size={12} /> },
            { id: 'dms', label: 'Direct messages', icon: <MessageSquare size={12} /> }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                filter === f.id 
                  ? 'bg-primary/10 text-primary border-[#E06A26]/30' 
                  : 'bg-bg text-text-muted hover:text-text hover:bg-bg-tertiary border-transparent hover:border-border'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4 bg-bg">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredConversations.length === 0 && filter !== 'dms' ? (
              <motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center p-8 text-text-muted text-sm">
                {filter === 'unread' ? "You're all caught up." : 'No chats found.'}
              </motion.div>
            ) : (
              <>
                {/* Unread is a flat list — grouping by type gets in the way when
                    you are working through a backlog. */}
                {filter === 'unread' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                    <div className="px-3 mb-2 flex items-center justify-between text-text-muted">
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        Unread
                      </span>
                    </div>
                    {filteredConversations.map(conv => renderConversationItem(conv))}
                  </motion.div>
                )}

                {(filter === 'all' || filter === 'channels') && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                    <div className="px-3 mb-2 flex items-center justify-between text-text-muted">
                      <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Hash size={12} />
                        Channels
                      </span>
                    </div>
                    {filteredConversations.filter(c => c.is_group).map(conv => renderConversationItem(conv))}
                    <button onClick={onOpenCreateChannel} className="w-full flex items-center gap-2.5 pr-2.5 pl-6 py-1.5 text-text-muted hover:text-text hover:bg-bg-secondary rounded-lg transition-colors mt-0.5 group">
                      <div className="w-6 h-6 flex items-center justify-center bg-bg-secondary group-hover:bg-bg-tertiary rounded-md transition-colors shrink-0">
                        <Plus size={14} />
                      </div>
                      <span className="text-[13px] font-medium">Add channels</span>
                    </button>
                  </motion.div>
                )}

                {(filter === 'all' || filter === 'dms') && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 mt-6">
                    <div className="px-3 mb-2 flex items-center justify-between text-text-muted">
                      <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare size={12} />
                        Direct messages
                      </span>
                    </div>
                    {filteredConversations.filter(c => !c.is_group).map(conv => renderConversationItem(conv))}
                    
                    {/* Other members without DMs yet */}
                    {filteredUsersWithoutDM.map(u => (
                      <button
                        key={u.id}
                        onClick={() => onStartDM && onStartDM(u.id)}
                        className="w-full flex items-center gap-2.5 pr-2.5 pl-6 py-1.5 rounded-lg transition-all text-left hover:bg-bg-secondary group"
                      >
                        <div className="relative shrink-0">
                          <div className="w-6 h-6 rounded-md bg-bg-secondary text-text-secondary group-hover:bg-bg-tertiary flex items-center justify-center font-medium text-[11px] overflow-hidden border border-border">
                            {u.image ? (
                              <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(u.name || 'User')
                            )}
                          </div>
                          {onlineUsers.has(u.id) && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-bg rounded-full z-10" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[13px] truncate text-text-secondary group-hover:text-text">
                            {u.name} {u.id === sessionUserId && <span className="text-text-muted font-normal ml-1">(you)</span>}
                          </h3>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
