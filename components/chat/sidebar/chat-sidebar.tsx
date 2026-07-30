import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Hash, MessageSquare, Loader2, User } from 'lucide-react'
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

  const filteredConversations = conversations.filter(c => {
    // Basic search
    const searchMatch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.participants?.some((p: any) => p.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (!searchMatch) return false

    if (filter === 'channels') return c.is_group
    if (filter === 'dms') return !c.is_group
    if (filter === 'unread') return (c.unreadCount || 0) > 0
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
            className="w-full bg-bg border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-full pl-9 pr-4 py-2 text-sm text-text transition-all outline-none shadow-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {['all', 'channels', 'dms'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'bg-bg text-text-muted hover:text-text hover:bg-bg-tertiary border border-border'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-bg">
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <AnimatePresence>
            {filteredConversations.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-8 text-text-muted text-sm">
                No chats found.
              </motion.div>
            ) : (
              filteredConversations.map(conv => {
                const isGroup = conv.is_group
                const otherParticipant = !isGroup ? conv.participants.find((p: any) => p.user_id !== sessionUserId)?.user : null
                const name = isGroup ? (conv.name || 'General') : (otherParticipant?.name || 'User')
                const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.id) : false
                const lastMsg = conv.messages?.[0]
                const isActive = activeConvId === conv.id

                return (
                  <motion.button
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${
                      isActive ? 'bg-bg-tertiary shadow-sm ring-1 ring-border-muted' : 'hover:bg-bg-secondary'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm overflow-hidden ${
                        isActive ? 'bg-primary/20 text-primary' : 'bg-bg-secondary text-text-secondary group-hover:bg-bg-tertiary'
                      }`}>
                        {isGroup ? (
                          <Hash size={18} />
                        ) : otherParticipant?.image ? (
                          <img src={otherParticipant.image} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(name)
                        )}
                      </div>
                      {!isGroup && isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-bg rounded-full z-10" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className={`font-semibold text-sm truncate ${isActive ? 'text-text' : (conv.unreadCount > 0 ? 'text-text' : 'text-text')}`}>
                          {name}
                        </h3>
                        {lastMsg && (
                          <span className={`text-[10px] font-medium shrink-0 ml-2 ${isActive ? 'text-primary' : (conv.unreadCount > 0 ? 'text-primary' : 'text-text-muted')}`}>
                            {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[12px] truncate ${isActive ? 'text-text-secondary' : (conv.unreadCount > 0 ? 'text-text font-medium' : 'text-text-muted')}`}>
                          {lastMsg ? (
                            <>
                              {lastMsg.sender_id === sessionUserId ? 'You: ' : ''}
                              {lastMsg.content || 'Attached a file'}
                            </>
                          ) : (
                            'Start a conversation'
                          )}
                        </p>
                        {(conv.unreadCount > 0) && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                )
              })
            )}
            
            {filter === 'dms' && filteredUsersWithoutDM.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <h3 className="px-3 text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Other Team Members</h3>
                <div className="space-y-1">
                  {filteredUsersWithoutDM.map(u => (
                    <button
                      key={u.id}
                      onClick={() => onStartDM && onStartDM(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left hover:bg-bg-secondary group"
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-bg-secondary text-text-secondary group-hover:bg-bg-tertiary flex items-center justify-center font-medium text-sm overflow-hidden">
                          {u.image ? (
                            <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(u.name || 'User')
                          )}
                        </div>
                        {onlineUsers.has(u.id) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-bg rounded-full z-10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate text-text">
                          {u.name}
                        </h3>
                        <p className="text-[12px] text-text-muted truncate">
                          Start a conversation
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
