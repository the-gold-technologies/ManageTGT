'use client'

import { useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Upload, File, Image, FileText, FileSpreadsheet,
  Download, Eye, Share2, Trash2, GitBranch, Plus, Loader2,
  CheckCircle2, X, AlertCircle, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  getFiles,
  createFileRecord,
  deleteFileRecord,
} from '@/app/actions/files'
import { uploadMultipleFilesAction } from '@/app/actions/upload'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import FilePreviewModal from './file-preview-modal'

type FileCategory = 'brand_assets' | 'reference' | 'deliverable' | 'contract' | 'invoice_docs' | 'content' | 'bill_receipt' | 'general'

type ContextType = 'client' | 'project' | 'prospect' | 'task' | 'invoice' | 'expense'

const CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'brand_assets', label: 'Brand Assets' },
  { value: 'reference', label: 'Reference' },
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'contract', label: 'Contract' },
  { value: 'invoice_docs', label: 'Invoice Doc' },
  { value: 'content', label: 'Content' },
  { value: 'bill_receipt', label: 'Bill / Receipt' },
]

const CATEGORY_COLORS: Record<string, string> = {
  brand_assets: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  reference: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  deliverable: 'bg-green-500/15 text-green-400 border-green-500/20',
  contract: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  invoice_docs: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  content: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  bill_receipt: 'bg-red-500/15 text-red-400 border-red-500/20',
  general: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
}

const DEFAULT_CATEGORY: Record<ContextType, FileCategory> = {
  client: 'general',
  project: 'deliverable',
  prospect: 'reference',
  task: 'deliverable',
  invoice: 'invoice_docs',
  expense: 'bill_receipt',
}

function getFileIcon(mimeType: string | null, name: string) {
  const m = mimeType || ''
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return Image
  if (m.includes('pdf') || ext === 'pdf') return FileText
  if (m.includes('sheet') || ['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet
  return File
}

function isImage(mimeType: string | null, name: string) {
  const m = mimeType || ''
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  return m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileWithStatus {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

export interface ContextFilePanelRef {
  uploadPendingFiles: (overrideContextId?: string) => Promise<boolean>
  hasPendingFiles: () => boolean
}

interface Props {
  /** The entity ID this panel is attached to */
  contextId: string
  /** The entity type */
  contextType: ContextType
  /** Optional uploader info */
  uploaderName?: string
  uploaderId?: string
  /** Override default category */
  defaultCategory?: FileCategory
  /** If true, hides the upload button so the parent can trigger upload via ref */
  deferUpload?: boolean
}

const ContextFilePanel = forwardRef<ContextFilePanelRef, Props>(({
  contextId,
  contextType,
  uploaderName,
  uploaderId,
  defaultCategory,
  deferUpload = false,
}, ref) => {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<FileWithStatus[]>([])
  const [showUploader, setShowUploader] = useState(false)
  const [category, setCategory] = useState<FileCategory>(defaultCategory ?? DEFAULT_CATEGORY[contextType])
  const [sourceDate, setSourceDate] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<any | null>(null)

  useImperativeHandle(ref, () => ({
    hasPendingFiles: () => pendingFiles.length > 0,
    uploadPendingFiles: async (overrideContextId?: string) => {
      return await handleUpload(overrideContextId)
    }
  }))

  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['context-files', contextType, contextId],
    queryFn: async () => {
      const result = await getFiles({ context: contextType, contextId })
      return result.files ?? []
    },
    enabled: !!contextId,
    staleTime: 30_000,
  })

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f => f.size <= 100 * 1024 * 1024)
    if (valid.length < newFiles.length) toast.error('Some files exceed 100MB')
    setPendingFiles(prev => [
      ...prev,
      ...valid.map(f => ({
        file: f,
        id: Math.random().toString(36).slice(2),
        status: 'pending' as const,
      })),
    ])
    setShowUploader(true)
  }, [])

  const handleUpload = async (overrideContextId?: string) => {
    if (pendingFiles.length === 0) return false
    setUploading(true)

    const finalContextId = overrideContextId || contextId
    if (!finalContextId) {
      toast.error('No context ID provided')
      setUploading(false)
      return false
    }

    const folder = `${contextType}s/${finalContextId}`
    const formData = new FormData()
    pendingFiles.forEach(f => formData.append('files', f.file))
    formData.append('folder', folder)

    setPendingFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })))
    const result = await uploadMultipleFilesAction(formData)

    if (!result.success || !result.urls) {
      toast.error('Upload failed')
      setPendingFiles(prev => prev.map(f => ({ ...f, status: 'error' as const })))
      setUploading(false)
      return false
    }

    let success = 0
    for (let i = 0; i < pendingFiles.length; i++) {
      const f = pendingFiles[i]
      const url = result.urls[i]
      if (!url) { setPendingFiles(prev => prev.map(ff => ff.id === f.id ? { ...ff, status: 'error' } : ff)); continue }

      const storagePath = url.split('/agencyos_files/')[1] || url
      const contextField: any = {}
      contextField[`${contextType}_id`] = finalContextId

      const r = await createFileRecord({
        name: f.file.name,
        url,
        storage_path: storagePath,
        size: f.file.size,
        mime_type: f.file.type,
        category,
        source_date: sourceDate || null,
        source_note: sourceNote || null,
        uploaded_by: uploaderId,
        uploader_name: uploaderName,
        ...contextField,
      })

      if (r.success) {
        success++
        setPendingFiles(prev => prev.map(ff => ff.id === f.id ? { ...ff, status: 'done' } : ff))
      } else {
        setPendingFiles(prev => prev.map(ff => ff.id === f.id ? { ...ff, status: 'error' } : ff))
      }
    }

    setUploading(false)
    if (success > 0) {
      toast.success(`${success} file${success > 1 ? 's' : ''} attached`)
      refetch()
      qc.invalidateQueries({ queryKey: ['files'] })
      setTimeout(() => {
        setPendingFiles([])
        setShowUploader(false)
        setSourceDate('')
        setSourceNote('')
      }, 600)
    }
    
    return success > 0
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    setDeletingId(confirmDeleteId)
    const result = await deleteFileRecord(confirmDeleteId)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (result.success) {
      toast.success('File removed')
      refetch()
      qc.invalidateQueries({ queryKey: ['files'] })
    } else {
      toast.error('Failed to delete file')
    }
  }

  return (
    <div className="space-y-3">
      {/* Hidden file input always available */}
      <input
        id={`file-input-${contextId}`}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files))
            // Reset the input value so the same file can be selected again if needed
            e.target.value = ''
          }
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Attachments
          </span>
          {!isLoading && files.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium">
              {files.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => document.getElementById(`file-input-${contextId}`)?.click()}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Plus size={12} />
          Add file
        </button>
      </div>

      {/* Upload Form */}
      <AnimatePresence>
        {showUploader && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-dashed border-border rounded-xl p-4 space-y-3 bg-bg-tertiary/30">


              {/* Pending file list */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5">
                  {pendingFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 bg-bg-secondary rounded-lg">
                      <File size={12} className="text-text-muted shrink-0" />
                      <span className="text-xs text-text truncate flex-1">{f.file.name}</span>
                      {f.status === 'uploading' && <Loader2 size={12} className="animate-spin text-primary shrink-0" />}
                      {f.status === 'done' && <CheckCircle2 size={12} className="text-green-400 shrink-0" />}
                      {f.status === 'error' && <AlertCircle size={12} className="text-red-400 shrink-0" />}
                      {f.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingFiles(p => {
                              const next = p.filter(ff => ff.id !== f.id)
                              if (next.length === 0) setShowUploader(false)
                              return next
                            })
                          }}
                          className="text-text-muted hover:text-red-400 shrink-0"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}


              {!deferUpload && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowUploader(false); setPendingFiles([]) }}
                    className="px-3 py-1.5 text-xs text-text-secondary hover:text-text border border-border rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpload()}
                    disabled={uploading || pendingFiles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                    {uploading ? 'Uploading...' : `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing files */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-12 bg-bg-secondary border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 && !showUploader ? (
        <div
          className="flex items-center gap-2 p-3 border border-dashed border-border rounded-xl text-text-muted text-xs cursor-pointer hover:border-primary/30 hover:text-text-secondary transition-all"
          onClick={() => document.getElementById(`file-input-${contextId}`)?.click()}
        >
          <FolderOpen size={14} />
          <span>No attachments yet · click to add files</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((file: any) => {
            const IconComp = getFileIcon(file.mime_type, file.name)
            const img = isImage(file.mime_type, file.name)
            const catColor = CATEGORY_COLORS[file.category] ?? CATEGORY_COLORS.general
            const catLabel = file.category?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

            return (
              <div
                key={file.id}
                className="group flex items-center gap-2.5 px-3 py-2 bg-bg-secondary border border-border rounded-xl hover:border-primary/30 transition-all"
              >
                {/* Thumbnail */}
                <div className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {img ? (
                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <IconComp size={14} className="text-text-muted" />
                  )}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{file.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn('text-[10px] px-1 py-0 rounded border', catColor)}>{catLabel}</span>
                    {file.source_date && (
                      <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                        <Calendar size={9} />
                        {format(new Date(file.source_date), 'dd MMM')}
                      </span>
                    )}
                    {file.size && <span className="text-[10px] text-text-muted">{formatBytes(file.size)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="p-1 rounded hover:bg-bg text-text-muted hover:text-text transition-colors"
                    title="Preview"
                  >
                    <Eye size={12} />
                  </button>
                  <a
                    href={file.url}
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-bg text-text-muted hover:text-text transition-colors"
                    title="Download"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download size={12} />
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(file.id)}
                    className="p-1 rounded hover:bg-bg text-text-muted hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        loading={!!deletingId}
        title="Remove Attachment"
        description="Permanently delete this file? This cannot be undone."
        confirmText="Delete"
        isDestructive
      />

      {/* Preview modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          categoryColors={CATEGORY_COLORS}
        />
      )}
    </div>
  )
})

export default ContextFilePanel
