'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Download, Share2, GitBranch, Calendar, AlignLeft,
  FileText, Image as ImageIcon, FileSpreadsheet, File,
  ExternalLink, Clock, User, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

function formatBytes(bytes: number | null) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string | null, name: string) {
  const m = mimeType || ''
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  return m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
}

function isPdf(mimeType: string | null, name: string) {
  return (mimeType || '').includes('pdf') || name?.endsWith('.pdf')
}

function getContextLabel(file: any) {
  if (file.client) return { label: 'Client', value: file.client.name }
  if (file.project) return { label: 'Project', value: `${file.project.project_code} — ${file.project.name}` }
  if (file.prospect) return { label: 'Prospect', value: file.prospect.name }
  if (file.task) return { label: 'Task', value: file.task.title }
  if (file.invoice) return { label: 'Invoice', value: file.invoice.invoice_number }
  if (file.expense) return { label: 'Expense', value: file.expense.description || file.expense.expense_type }
  return null
}

interface Props {
  file: any
  onClose: () => void
  categoryColors: Record<string, string>
}

export default function FilePreviewModal({ file, onClose, categoryColors }: Props) {
  const img = isImage(file.mime_type, file.name)
  const pdf = isPdf(file.mime_type, file.name)
  const context = getContextLabel(file)
  const categoryColor = categoryColors[file.category] ?? categoryColors.general
  const categoryLabel = file.category?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-5xl h-[90vh] bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text truncate">{file.name}</h3>
              <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:text-text hover:bg-bg-secondary transition-all"
              >
                <ExternalLink size={12} /> Open
              </a>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-all"
              >
                <Download size={12} /> Download
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body — preview + metadata */}
          <div className="flex flex-1 overflow-hidden">
            {/* Preview Area */}
            <div className="flex-1 bg-bg-tertiary flex items-center justify-center overflow-hidden">
              {img ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : pdf ? (
                <iframe
                  src={file.url}
                  className="w-full h-full border-0"
                  title={file.name}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center p-8">
                  <div className="w-20 h-20 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
                    <File size={36} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{file.name}</p>
                    <p className="text-xs text-text-muted mt-1">Preview not available for this file type</p>
                  </div>
                  <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
                    <Download size={14} /> Download to view
                  </button>
                </div>
              )}
            </div>

            {/* Metadata Sidebar */}
            <div className="w-64 shrink-0 border-l border-border overflow-y-auto py-4 px-4 space-y-4 bg-bg">
              {/* Category */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Category</p>
                <span className={cn('inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border', categoryColor)}>
                  {categoryLabel}
                </span>
              </div>

              {/* Version */}
              {file.version > 1 && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Version</p>
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <GitBranch size={13} className="text-text-muted" />
                    Version {file.version}
                  </div>
                </div>
              )}

              {/* Context */}
              {context && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">{context.label}</p>
                  <p className="text-sm text-text">{context.value}</p>
                </div>
              )}

              {/* Uploader */}
              {file.uploader_name && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Uploaded By</p>
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <User size={13} className="text-text-muted" />
                    {file.uploader_name}
                  </div>
                </div>
              )}

              {/* Upload date */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Uploaded On</p>
                <div className="flex items-center gap-1.5 text-sm text-text">
                  <Clock size={13} className="text-text-muted" />
                  {format(new Date(file.createdAt), 'dd MMM yyyy, h:mm a')}
                </div>
              </div>

              {/* Source date */}
              {file.source_date && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Date Received</p>
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Calendar size={13} className="text-text-muted" />
                    {format(new Date(file.source_date), 'dd MMM yyyy')}
                  </div>
                </div>
              )}

              {/* Note */}
              {file.source_note && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Note</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{file.source_note}</p>
                </div>
              )}

              {/* Shared with */}
              {file.shared_with?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Shared With</p>
                  <p className="text-xs text-text-secondary">{file.shared_with.length} team member{file.shared_with.length > 1 ? 's' : ''}</p>
                </div>
              )}

              {/* Size + Type */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">File Info</p>
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary">{formatBytes(file.size)}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
