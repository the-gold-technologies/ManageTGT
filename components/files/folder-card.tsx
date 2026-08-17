'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, FolderOpen, MoreVertical, Pencil, Trash2, Files, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { renameFolder, deleteFolder } from '@/app/actions/folder-actions'
import { Button } from '@/components/ui/button'

interface FolderCardProps {
  folder: {
    id: string
    name: string
    context: string
    context_id?: string | null
    files?: { id: string }[]
    _count?: number   // for built-in folders passing file count directly
  }
  view: 'grid' | 'list'
  isBuiltIn?: boolean   // built-in = auto-generated from entity (project/client etc.)
  fileCount?: number    // override if not using folder.files
  onClick: () => void
  onUpdated: () => void
  isDragOver?: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

function DeleteDialog({
  open,
  folderName,
  fileCount,
  onClose,
  onConfirm,
}: {
  open: boolean
  folderName: string
  fileCount: number
  onClose: () => void
  onConfirm: (mode: 'move' | 'delete') => void
}) {
  const [mode, setMode] = useState<'move' | 'delete'>('move')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-bg border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text">Delete "{folderName}"</h3>
                <p className="text-xs text-text-muted mt-0.5">This folder has {fileCount} file(s)</p>
              </div>
              <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-bg-secondary">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2 mb-5">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:border-border-muted cursor-pointer transition-all">
                <input type="radio" name="dm" value="move" checked={mode === 'move'} onChange={() => setMode('move')} className="accent-primary" />
                <div>
                  <p className="text-xs font-medium text-text">Keep files</p>
                  <p className="text-[10px] text-text-muted">Files will be moved to root</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:border-danger/30 cursor-pointer transition-all">
                <input type="radio" name="dm" value="delete" checked={mode === 'delete'} onChange={() => setMode('delete')} className="accent-danger" />
                <div>
                  <p className="text-xs font-medium text-danger">Delete all files too</p>
                  <p className="text-[10px] text-text-muted">Permanently removes the folder and all files</p>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text hover:bg-bg-secondary rounded-lg transition-all">
                Cancel
              </button>
              <Button
                variant={mode === 'delete' ? 'danger' : 'secondary'}
                onClick={() => onConfirm(mode)}
                className="text-xs px-3 py-1.5 h-auto"
              >
                {mode === 'delete' ? 'Delete Everything' : 'Delete Folder'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function FolderCard({
  folder,
  view,
  isBuiltIn = false,
  fileCount: fileCountProp,
  onClick,
  onUpdated,
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fileCount = fileCountProp ?? folder.files?.length ?? 0

  async function handleRename() {
    if (!renameValue.trim() || renameValue === folder.name) {
      setRenaming(false)
      return
    }
    const res = await renameFolder(folder.id, renameValue.trim())
    if (res.success) {
      toast.success('Folder renamed')
      onUpdated()
    } else {
      toast.error(res.error || 'Failed to rename folder')
    }
    setRenaming(false)
  }

  async function handleDelete(mode: 'move' | 'delete') {
    const res = await deleteFolder(folder.id, mode === 'delete')
    if (res.success) {
      toast.success('Folder deleted')
      onUpdated()
    } else {
      toast.error(res.error || 'Failed to delete folder')
    }
    setDeleteOpen(false)
  }

  const MenuDropdown = () => (
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute right-0 top-full mt-1 w-36 bg-bg border border-border rounded-xl shadow-xl z-50 overflow-hidden"
        >
          <button
            onClick={() => {
              setMenuOpen(false)
              setRenaming(true)
              setRenameValue(folder.name)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text hover:bg-bg-secondary transition-all"
          >
            <Pencil size={12} /> Rename
          </button>
          <button
            onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-all"
          >
            <Trash2 size={12} /> Delete
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const FolderGradientDefs = () => (
    <svg width="0" height="0" className="absolute pointer-events-none">
      <defs>
        <linearGradient id="folder-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  )

  if (view === 'list') {
    return (
      <>
        <motion.div
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer group',
            isDragOver
              ? 'bg-primary/15 border-primary shadow-lg scale-[1.01]'
              : 'bg-bg border-border hover:border-border-muted hover:bg-bg-tertiary'
          )}
          onClick={!renaming ? onClick : undefined}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <FolderGradientDefs />
          {isDragOver
            ? <FolderOpen size={22} stroke="url(#folder-gradient)" fill="url(#folder-gradient)" fillOpacity={0.4} className="shrink-0" />
            : <Folder size={22} stroke="url(#folder-gradient)" fill="url(#folder-gradient)" className="shrink-0" />
          }

          {renaming ? (
            <input
              ref={inputRef}
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
              onBlur={handleRename}
              className="flex-1 bg-transparent border-b border-primary text-sm text-text outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm font-medium text-text truncate">{folder.name}</span>
          )}

          <span className="text-xs text-text-muted shrink-0 flex items-center gap-1">
            <Files size={11} /> {fileCount}
          </span>

          {!isBuiltIn && (
            <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  menuOpen ? 'bg-bg-secondary text-text' : 'text-text-muted hover:text-text hover:bg-bg-secondary'
                )}
              >
                <MoreVertical size={16} />
              </button>
              <MenuDropdown />
            </div>
          )}
        </motion.div>

        <DeleteDialog open={deleteOpen} folderName={folder.name} fileCount={fileCount} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} />
      </>
    )
  }

  // Grid view
  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'relative flex items-center gap-3.5 p-3 pl-4 rounded-xl border cursor-pointer group transition-all select-none',
          isDragOver
            ? 'bg-primary/15 border-primary shadow-lg scale-[1.02]'
            : 'bg-bg border-border hover:border-border-muted hover:bg-bg-tertiary hover:shadow-sm'
        )}
        onClick={!renaming ? onClick : undefined}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <FolderGradientDefs />
        <div className="flex items-center justify-center shrink-0 drop-shadow-sm">
          {isDragOver
            ? <FolderOpen size={32} stroke="url(#folder-gradient)" fill="url(#folder-gradient)" fillOpacity={0.4} className="transition-all" />
            : <Folder size={32} stroke="url(#folder-gradient)" fill="url(#folder-gradient)" className="group-hover:scale-105 transition-transform" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              ref={inputRef}
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
              onBlur={handleRename}
              className="w-full bg-transparent border-b border-primary text-sm font-medium text-text outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className="text-sm font-medium text-text truncate pr-2">{folder.name}</div>
          )}
          <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
            <Files size={10} /> {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </div>
        </div>

        {!isBuiltIn && (
          <div className="relative shrink-0 ml-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                menuOpen ? 'bg-bg-secondary text-text' : 'text-text-muted hover:text-text hover:bg-bg-secondary'
              )}
            >
              <MoreVertical size={16} />
            </button>
            <MenuDropdown />
          </div>
        )}
      </motion.div>

      <DeleteDialog open={deleteOpen} folderName={folder.name} fileCount={fileCount} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} />
    </>
  )
}
