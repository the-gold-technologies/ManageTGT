'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  FileText, Image, FileSpreadsheet, File, Download, Eye,
  Share2, GitBranch, Archive, Trash2, MoreVertical, Calendar,
  User, Tag, ExternalLink,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { deleteFileRecord, updateFileRecord } from '@/app/actions/files'
import { ConfirmModal } from '@/components/ui/confirm-modal'

function getFileIcon(mimeType: string | null, name: string) {
  if (!mimeType && !name) return File
  const m = mimeType || ''
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image
  if (m.includes('pdf') || ext === 'pdf') return FileText
  if (m.includes('sheet') || m.includes('excel') || ['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet
  if (m.includes('word') || m.includes('document') || ['doc', 'docx'].includes(ext)) return FileText
  return File
}

function isImage(mimeType: string | null, name: string) {
  const m = mimeType || ''
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  return m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
}

function isPdf(mimeType: string | null, name: string) {
  const m = mimeType || ''
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  return m.includes('pdf') || ext === 'pdf'
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getContextData(file: any): { label: string, href: string | null } {
  if (file.client) return { label: `Client: ${file.client.name}`, href: `/clients?clientId=${file.client.id}` }
  if (file.project) return { label: `Project: ${file.project.name}`, href: `/projects?projectId=${file.project.id}` }
  if (file.prospect) return { label: `Prospect: ${file.prospect.name}`, href: `/finance/prospects?prospectId=${file.prospect.id}` }
  if (file.task) return { label: `Task: ${file.task.title}`, href: `/my-tasks?taskId=${file.task.id}` }
  if (file.invoice) return { label: `Invoice: ${file.invoice.invoice_number}`, href: `/finance/invoices?invoiceId=${file.invoice.id}` }
  if (file.expense) return { label: `Expense: ${file.expense.description || file.expense.expense_type}`, href: `/finance/expenses?expenseId=${file.expense.id}` }
  return { label: 'General', href: null }
}

interface FileCardProps {
  file: any
  view: 'grid' | 'list'
  categoryColors: Record<string, string>
  onPreview: () => void
  onShare: () => void
  onVersions: () => void
  onDeleted: () => void
}

export default function FileCard({ file, view, categoryColors, onPreview, onShare, onVersions, onDeleted }: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const IconComp = getFileIcon(file.mime_type, file.name)
  const isImg = isImage(file.mime_type, file.name)
  const isPdfFile = isPdf(file.mime_type, file.name)
  const categoryColor = categoryColors[file.category] ?? categoryColors.general
  const categoryLabel = file.category?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const contextData = getContextData(file)

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteFileRecord(file.id)
    setIsDeleting(false)
    if (result.success) {
      toast.success('File deleted')
      onDeleted()
    } else {
      toast.error('Failed to delete file')
    }
    setConfirmDelete(false)
  }



  const handleDownload = async () => {
    try {
      const res = await fetch(file.url)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(file.url, '_blank')
    }
  }

  if (view === 'list') {
    return (
      <>
        <motion.div
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          className={cn(
            'group flex items-center gap-4 px-4 py-3 bg-bg-secondary border border-border rounded-xl hover:border-primary/30 hover:bg-bg-tertiary transition-all cursor-pointer'
          )}
          onClick={onPreview}
        >
          {/* Icon / Thumb */}
          <div className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center shrink-0 overflow-hidden">
            {isImg ? (
              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
            ) : (
              <IconComp size={18} className="text-text-muted" />
            )}
          </div>

          {/* Name + context */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{file.name}</p>
            <p className="text-xs text-text-muted truncate">{contextData.label}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border', categoryColor)}>
                {categoryLabel}
              </span>
              {contextData.label !== 'General' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-bg border border-border text-text-secondary truncate max-w-[250px]">
                  {contextData.label.split(': ')[1]}
                </span>
              )}
            </div>
          </div>

          {/* Version */}
          {file.version > 1 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-text-muted">
              <GitBranch size={11} /> v{file.version}
            </span>
          )}

          {/* Date */}
          {file.source_date && (
            <span className="hidden md:inline-flex items-center gap-1 text-xs text-text-muted whitespace-nowrap">
              <Calendar size={11} />
              {format(new Date(file.source_date), 'dd MMM yyyy')}
            </span>
          )}

          {/* Size */}
          <span className="hidden lg:block text-xs text-text-muted whitespace-nowrap">
            {formatBytes(file.size)}
          </span>

          {/* Actions */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-bg border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <button onClick={() => { onPreview(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text hover:bg-bg-secondary transition-colors">
                    <Eye size={12} /> Preview
                  </button>
                  <button onClick={() => { handleDownload(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text hover:bg-bg-secondary transition-colors">
                    <Download size={12} /> Download
                  </button>
                  <button onClick={() => { onShare(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text hover:bg-bg-secondary transition-colors">
                    <Share2 size={12} /> Share
                  </button>
                  <button onClick={() => { onVersions(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text hover:bg-bg-secondary transition-colors">
                    <GitBranch size={12} /> Version History
                  </button>
                  <button onClick={() => { setConfirmDelete(true); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <ConfirmModal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          loading={isDeleting}
          title="Delete File"
          description={`Are you sure you want to permanently delete "${file.name}"? This cannot be undone.`}
          confirmText="Delete"
          isDestructive
        />
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
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'group relative flex flex-col bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer'
        )}
        onClick={onPreview}
      >
        {/* Thumbnail / Preview area */}
        <div className="relative h-24 bg-bg-tertiary flex items-center justify-center overflow-hidden">
          {isImg ? (
            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
          ) : isPdfFile ? (
            <div className="absolute inset-0 overflow-hidden">
              <iframe src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="absolute top-0 left-0 w-[calc(100%+20px)] h-[calc(100%+20px)] border-0 pointer-events-none" scrolling="no" tabIndex={-1} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <IconComp size={32} className="text-text-muted" />
              <span className="text-[10px] text-text-muted uppercase font-medium">
                {file.name?.split('.').pop() || 'file'}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
            <button
              onClick={e => { e.stopPropagation(); onPreview() }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Preview"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDownload() }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download"
            >
              <Download size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onShare() }}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Share"
            >
              <Share2 size={14} />
            </button>
          </div>

          {/* Top-left Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 items-start group-hover:opacity-0 transition-opacity z-20 max-w-[85%]">
            {contextData.label !== 'General' && (
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border shadow-sm truncate max-w-full',
                (isImg || isPdfFile) 
                  ? 'bg-black/60 text-white border-white/20 backdrop-blur-sm' 
                  : 'bg-bg text-text-secondary border-border'
              )}>
                {contextData.label.split(': ')[1]}
              </span>
            )}

            {file.version > 1 && (
              <div className="flex items-center gap-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-sm shadow-sm">
                <GitBranch size={9} /> v{file.version}
              </div>
            )}
          </div>

          {/* Bottom-right Badges */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-1 items-end group-hover:opacity-0 transition-opacity z-20">
            <div className={cn(
              "rounded",
              (isImg || isPdfFile) ? "bg-bg/90 backdrop-blur-sm" : ""
            )}>
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border shadow-sm',
                categoryColor
              )}>
                {categoryLabel}
              </span>
            </div>
          </div>


        </div>

        {/* Card body */}
        <div className="px-3 py-2 flex flex-col flex-1">
          <p className="text-xs font-medium text-text truncate" title={file.name}>{file.name}</p>

          {/* Bottom row: Date + Size */}
          <div className="flex items-center justify-between mt-auto pt-1">
            <span className="flex items-center gap-1 text-[9px] text-text-muted">
              <Calendar size={9} />
              {format(new Date(file.source_date || file.createdAt), 'dd MMM yyyy')}
            </span>
            {file.size && (
              <span className="text-[9px] text-text-muted">{formatBytes(file.size)}</span>
            )}
          </div>
        </div>

        {/* Three-dot menu */}
        <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 rounded-md bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
            >
              <MoreVertical size={13} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-bg border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <button onClick={() => { onVersions(); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-text hover:bg-bg-secondary transition-colors">
                    <GitBranch size={12} /> Version History
                  </button>
                  <button onClick={() => { setConfirmDelete(true); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete File"
        description={`Permanently delete "${file.name}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
      />
    </>
  )
}
