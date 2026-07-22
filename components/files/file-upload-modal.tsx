'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Upload, File, Image, FileText, FileSpreadsheet,
  Loader2, ChevronDown, Calendar, AlignLeft, FolderOpen,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { uploadMultipleFilesAction } from '@/app/actions/upload'
import { createFileRecord } from '@/app/actions/files'
import { Button } from '@/components/ui/button'

type FileCategory = 'brand_assets' | 'reference' | 'deliverable' | 'contract' | 'invoice_docs' | 'content' | 'bill_receipt' | 'general'
type ContextType = 'client' | 'project' | 'prospect' | 'none'

const CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'brand_assets', label: 'Brand Assets' },
  { value: 'reference', label: 'Reference Material' },
  { value: 'deliverable', label: 'Deliverable' },
  { value: 'contract', label: 'Contract / Proposal' },
  { value: 'invoice_docs', label: 'Invoice Document' },
  { value: 'content', label: 'Content' },
  { value: 'bill_receipt', label: 'Bill / Receipt' },
]

interface Props {
  open: boolean
  onClose: () => void
  clients: any[]
  projects: any[]
  onSuccess: () => void
  currentUserId: string
}

interface FileWithPreview {
  file: File
  id: string
  preview?: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  url?: string
}

export default function FileUploadModal({ open, onClose, clients, projects, onSuccess, currentUserId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [category, setCategory] = useState<FileCategory>('general')
  const [contextType, setContextType] = useState<ContextType>('none')
  const [contextId, setContextId] = useState('')
  const [sourceDate, setSourceDate] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [uploading, setUploading] = useState(false)

  const reset = () => {
    setFiles([])
    setCategory('general')
    setContextType('none')
    setContextId('')
    setSourceDate('')
    setSourceNote('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f => f.size <= 100 * 1024 * 1024)
    if (valid.length < newFiles.length) toast.error('Some files exceed the 100MB limit')
    const entries: FileWithPreview[] = valid.map(f => {
      const isImg = f.type.startsWith('image/')
      return {
        file: f,
        id: Math.random().toString(36).slice(2),
        preview: isImg ? URL.createObjectURL(f) : undefined,
        status: 'pending',
      }
    })
    setFiles(prev => [...prev, ...entries])
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }, [addFiles])

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file')
      return
    }
    if (contextType !== 'none' && !contextId) {
      toast.error('Please select a specific client or project')
      return
    }

    setUploading(true)

    // Mark all as uploading
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })))

    const folder = contextType !== 'none' && contextId
      ? `${contextType}s/${contextId}`
      : 'general'

    const formData = new FormData()
    files.forEach(f => formData.append('files', f.file))
    formData.append('folder', folder)

    const uploadResult = await uploadMultipleFilesAction(formData)

    if (!uploadResult.success || !uploadResult.urls) {
      toast.error('Upload failed: ' + uploadResult.error)
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const })))
      setUploading(false)
      return
    }

    const urls = uploadResult.urls
    let successCount = 0

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const url = urls[i]
      if (!url) {
        setFiles(prev => prev.map(ff => ff.id === f.id ? { ...ff, status: 'error' } : ff))
        continue
      }

      const storagePath = url.split('/agencyos_files/')[1] || url
      const contextField: any = {}
      if (contextType === 'client') contextField.client_id = contextId
      if (contextType === 'project') contextField.project_id = contextId
      if (contextType === 'prospect') contextField.prospect_id = contextId

      const result = await createFileRecord({
        name: f.file.name,
        url,
        storage_path: storagePath,
        size: f.file.size,
        mime_type: f.file.type,
        category,
        source_date: sourceDate || null,
        source_note: sourceNote || null,
        uploaded_by: currentUserId,
        ...contextField,
      })

      if (result.success) {
        setFiles(prev => prev.map(ff => ff.id === f.id ? { ...ff, status: 'done', url } : ff))
        successCount++
      } else {
        setFiles(prev => prev.map(ff => ff.id === f.id ? { ...ff, status: 'error' } : ff))
      }
    }

    setUploading(false)
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`)
      onSuccess()
      setTimeout(handleClose, 800)
    }
  }

  const contextOptions = contextType === 'client'
    ? clients.map((c: any) => ({ value: c.id, label: c.name + (c.company_name ? ` (${c.company_name})` : '') }))
    : contextType === 'project'
    ? projects.map((p: any) => ({ value: p.id, label: `${p.project_code} — ${p.name}` }))
    : []

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-xl bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Upload size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text">Upload File</h3>
                  <p className="text-xs text-text-muted">Max 100MB · PDF, Word, Excel, Images</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/40 hover:bg-bg-secondary'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
                />
                <FolderOpen size={28} className="mx-auto mb-2 text-text-muted" />
                <p className="text-sm font-medium text-text">Drop files here or click to browse</p>
                <p className="text-xs text-text-muted mt-1">PDF, Word, Excel, Images up to 100MB each</p>
              </div>

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-2.5 bg-bg-secondary border border-border rounded-lg">
                      {f.preview ? (
                        <img src={f.preview} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <File size={16} className="text-text-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text truncate">{f.file.name}</p>
                        <p className="text-[10px] text-text-muted">{(f.file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      {f.status === 'uploading' && <Loader2 size={14} className="text-primary animate-spin shrink-0" />}
                      {f.status === 'done' && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
                      {f.status === 'error' && <AlertCircle size={14} className="text-red-400 shrink-0" />}
                      {f.status === 'pending' && (
                        <button onClick={() => setFiles(prev => prev.filter(ff => ff.id !== f.id))} className="text-text-muted hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}


              {/* Context */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Attach to</label>
                <div className="flex gap-2 mb-2">
                  {(['none', 'client', 'project'] as ContextType[]).map(v => (
                    <button
                      key={v}
                      onClick={() => { setContextType(v); setContextId('') }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize',
                        contextType === v
                          ? 'bg-primary text-white border-transparent'
                          : 'border-border text-text-secondary hover:text-text hover:bg-bg-secondary'
                      )}
                    >
                      {v === 'none' ? 'General' : v}
                    </button>
                  ))}
                </div>
                {contextType !== 'none' && contextOptions.length > 0 && (
                  <select
                    value={contextId}
                    onChange={e => setContextId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-all"
                  >
                    <option value="">Select {contextType}...</option>
                    {contextOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Source Info */}
              <div className="p-3 bg-bg-secondary border border-border rounded-xl space-y-3">
                <p className="text-xs font-medium text-text-secondary">Source Info (optional)</p>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Date received</label>
                  <input
                    type="date"
                    value={sourceDate}
                    onChange={e => setSourceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Note</label>
                  <textarea
                    value={sourceNote}
                    onChange={e => setSourceNote(e.target.value)}
                    placeholder="e.g. Client sent final logo for rebranding..."
                    rows={2}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-bg-secondary">
              <Button variant="outline" onClick={handleClose} disabled={uploading}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={uploading || files.length === 0} className="gap-2">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Uploading...' : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
