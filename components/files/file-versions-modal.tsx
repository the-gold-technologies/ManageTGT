'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, GitBranch, Download, Clock, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { getFileVersions } from '@/app/actions/files'

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  file: any
  onClose: () => void
}

export default function FileVersionsModal({ file, onClose }: Props) {
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFileVersions(file.id).then(r => {
      setVersions(r.versions ?? [])
      setLoading(false)
    })
  }, [file.id])

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(url, '_blank')
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
          className="relative w-full max-w-lg bg-bg border border-border rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <GitBranch size={15} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">Version History</h3>
                <p className="text-xs text-text-muted truncate max-w-[260px]">{file.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-muted" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch size={28} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">No version history found</p>
              </div>
            ) : (
              <div className="relative space-y-3">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border" />

                {versions.map((v, idx) => (
                  <div key={v.id} className="flex gap-3 items-start pl-1">
                    {/* Version dot */}
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 z-10',
                      idx === versions.length - 1
                        ? 'bg-primary border-primary text-white'
                        : 'bg-bg border-border text-text-muted'
                    )}>
                      {idx === versions.length - 1
                        ? <CheckCircle size={14} />
                        : <span className="text-xs font-bold">v{v.version}</span>
                      }
                    </div>

                    {/* Version info */}
                    <div className="flex-1 bg-bg-secondary border border-border rounded-xl p-3 hover:border-primary/30 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-text">Version {v.version}</span>
                            {idx === versions.length - 1 && (
                              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-medium">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5 truncate">{v.name}</p>
                        </div>
                        <button
                          onClick={() => handleDownload(v.url, v.name)}
                          className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-bg text-text-muted hover:text-text transition-all shrink-0"
                          title="Download this version"
                        >
                          <Download size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                        {v.uploader_name && (
                          <span>by {v.uploader_name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={9} />
                          {format(new Date(v.createdAt), 'dd MMM yyyy, h:mm a')}
                        </span>
                        {v.size && <span>{formatBytes(v.size)}</span>}
                      </div>

                      {v.source_note && (
                        <p className="text-[11px] text-text-secondary mt-1.5 italic">"{v.source_note}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
