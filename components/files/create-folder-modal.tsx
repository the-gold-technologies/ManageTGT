'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderPlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createFolder } from '@/app/actions/folder-actions'
import { Button } from '@/components/ui/button'

interface CreateFolderModalProps {
  open: boolean
  onClose: () => void
  context: string
  contextId?: string
  onCreated: (folder: any) => void
}

export default function CreateFolderModal({
  open,
  onClose,
  context,
  contextId,
  onCreated,
}: CreateFolderModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    const res = await createFolder(name.trim(), context, contextId)
    setLoading(false)
    if (res.success) {
      toast.success('Folder created')
      onCreated(res.folder)
      onClose()
    } else {
      toast.error(res.error || 'Failed to create folder')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-bg border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center">
                  <FolderPlus size={18} className="text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-text">New Folder</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-secondary transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Input */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Folder Name</label>
              <input
                ref={inputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') onClose()
                }}
                placeholder="e.g. Brand Assets, Contracts..."
                className="w-full px-3 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/60 transition-all"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text hover:bg-bg-secondary rounded-xl transition-all"
              >
                Cancel
              </button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || loading}
                className="gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
                Create Folder
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
