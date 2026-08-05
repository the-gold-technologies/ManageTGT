'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getInitials } from '@/lib/utils'

interface CreateChannelModalProps {
  open: boolean
  onClose: () => void
  users: any[]
  channelName: string
  setChannelName: (name: string) => void
  selectedMembers: string[]
  setSelectedMembers: (members: string[] | ((prev: string[]) => string[])) => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
}

export function CreateChannelModal({
  open,
  onClose,
  users,
  channelName,
  setChannelName,
  selectedMembers,
  setSelectedMembers,
  onSubmit,
  isSubmitting
}: CreateChannelModalProps) {
  
  const [searchQuery, setSearchQuery] = React.useState('')

  const filteredUsers = users.filter((u) => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const inputClass = "w-full px-3 py-2 bg-bg border border-border-muted rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] !m-0"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: "-45%", x: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, y: "-45%", x: "-50%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md bg-bg-secondary border border-border rounded-2xl z-[70] flex flex-col shadow-2xl overflow-hidden !m-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg">
              <h3 className="font-semibold text-text">New Channel</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={onSubmit} className="flex flex-col flex-1 max-h-[70vh]">
              <div className="p-5 space-y-4 border-b border-border">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Channel Name</label>
                  <input
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="e.g. Project Alpha"
                    className={inputClass}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Members Selection */}
              <div className="flex-1 flex flex-col min-h-[250px] overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-bg/50">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search members..."
                      className="w-full bg-bg border border-border-muted rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary text-text"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-6 text-text-muted text-sm">No users found</div>
                  ) : (
                    <div className="space-y-1">
                      {filteredUsers.map((user) => (
                        <div 
                          key={user.id} 
                          onClick={() => toggleMember(user.id)}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-tertiary cursor-pointer transition-colors"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            selectedMembers.includes(user.id) ? 'bg-primary border-primary text-white' : 'border-border'
                          }`}>
                            {selectedMembers.includes(user.id) && <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                          </div>
                          
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden">
                            {user.image ? <img src={user.image} alt={user.name} className="w-full h-full object-cover" /> : getInitials(user.name || 'U')}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text truncate">{user.name}</p>
                            <p className="text-[11px] text-text-muted truncate">{user.email || user.role?.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-border bg-bg shrink-0">
                <span className="text-xs text-text-muted font-medium">
                  {selectedMembers.length} member{selectedMembers.length !== 1 && 's'} selected
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting} className="text-sm h-9 px-4">
                    Cancel
                  </Button>
                  <Button type="submit" loading={isSubmitting} disabled={!channelName.trim()} className="text-sm h-9 px-4">
                    Create Channel
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
