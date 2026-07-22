'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, Search, Check, UserCheck, Loader2, Users, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { shareFileWithUsers, unshareFileFromUsers } from '@/app/actions/files'
import { Button } from '@/components/ui/button'

interface Props {
  file: any
  users: { id: string; name: string | null; image: string | null }[]
  onClose: () => void
  onShared: () => void
}

export default function FileShareModal({ file, users, onClose, onShared }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(file.shared_with ?? []))
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(file.url)
    setCopied(true)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const toAdd = [...selected].filter(id => !(file.shared_with ?? []).includes(id))
    const toRemove = (file.shared_with ?? []).filter((id: string) => !selected.has(id))

    let ok = true
    if (toAdd.length > 0) {
      const r = await shareFileWithUsers(file.id, toAdd)
      if (!r.success) ok = false
    }
    if (toRemove.length > 0) {
      const r = await unshareFileFromUsers(file.id, toRemove)
      if (!r.success) ok = false
    }

    setSaving(false)
    if (ok) {
      toast.success('File sharing updated')
      onShared()
      onClose()
    } else {
      toast.error('Failed to update sharing')
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Share2 size={15} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">Share File</h3>
                <p className="text-xs text-text-muted truncate max-w-[220px]">{file.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Public Link */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Public Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={file.url}
                  className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-secondary outline-none"
                  onClick={e => e.currentTarget.select()}
                />
                <Button type="button" onClick={handleCopyLink} className="gap-2 shrink-0 px-3 h-[38px] bg-bg-secondary text-text hover:bg-bg-tertiary border border-border">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-8 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>

            {/* User list */}
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">No team members found</p>
              )}
              {filtered.map(user => (
                <button
                  key={user.id}
                  onClick={() => toggle(user.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    selected.has(user.id)
                      ? 'bg-primary/10 border border-border'
                      : 'hover:bg-bg-secondary border border-transparent'
                  )}
                >
                  {/* Avatar */}
                  {user.image ? (
                    <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-bg-tertiary border border-border flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-text-muted">
                        {user.name?.charAt(0).toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}

                  <span className="flex-1 text-left font-medium text-text truncate">
                    {user.name ?? 'Unknown'}
                  </span>

                  {selected.has(user.id) && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                      <Check size={12} /> Has Access
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Selected count */}
            {selected.size > 0 && (
              <p className="text-xs text-text-muted">
                <span className="text-primary font-medium">{selected.size}</span> team member{selected.size > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-bg-secondary">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
              {saving ? 'Sharing...' : 'Share'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
