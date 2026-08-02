'use client'

import { useState, useEffect } from 'react'
import { Activity, StickyNote, File, FileImage, FileArchive, FileText, Trash2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Quick Notes Widget (localStorage-backed) ──────────────────────────────
interface Note {
  id: string
  text: string
  createdAt: string
}

export function QuickNotesWidget() {
  const [notes, setNotes] = useState<Note[]>([])
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('dashboard_quick_notes')
      if (saved) setNotes(JSON.parse(saved))
    } catch {}
  }, [])

  const save = (updated: Note[]) => {
    setNotes(updated)
    localStorage.setItem('dashboard_quick_notes', JSON.stringify(updated))
  }

  const addNote = () => {
    const text = input.trim()
    if (!text) return
    save([{ id: Date.now().toString(), text, createdAt: new Date().toISOString() }, ...notes])
    setInput('')
  }

  const deleteNote = (id: string) => save(notes.filter(n => n.id !== id))

  if (!mounted) return null

  return (
    <div className="rounded-2xl bg-bg-secondary border border-border p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote size={14} className="text-warning" />
        <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">Quick Notes</h3>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
          placeholder="Type a note and press Enter..."
          className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-text-muted outline-none focus:border-warning/50 transition-colors"
        />
        <button
          onClick={addNote}
          className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 text-warning flex items-center justify-center hover:bg-warning/20 transition-colors shrink-0"
        >
          <Send size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-hidden">
        {notes.length > 0 ? (
          notes.slice(0, 5).map(note => (
            <div key={note.id} className="group flex items-start gap-2 p-2 -mx-2 rounded-xl hover:bg-bg-tertiary transition-colors">
              <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
              <p className="text-[12px] text-text flex-1 leading-snug">{note.text}</p>
              <button
                onClick={() => deleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-xs text-text-muted py-6">No notes yet. Add one above!</p>
        )}
      </div>
    </div>
  )
}

// ─── Recent Activity Widget ────────────────────────────────────────────────
export function RecentActivityWidget({ activities }: { activities: any[] }) {
  return (
    <div className="rounded-2xl bg-bg-secondary border border-border p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} className="text-primary" />
        <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">Recent Activity</h3>
      </div>
      <div className="flex flex-col gap-3">
        {activities && activities.length > 0 ? (
          activities.slice(0, 6).map((log: any, i: number) => (
            <div key={log.id || i} className="flex items-start gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold uppercase overflow-hidden text-primary">
                {log.performed_by?.avatar_url
                  ? <img src={log.performed_by.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : (log.performed_by?.full_name?.[0] || 'S')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-text leading-snug">
                  <span className="font-semibold">{log.performed_by?.full_name || 'System'}</span>
                  <span className="text-text-muted"> {log.action?.toLowerCase().replace(/_/g, ' ')}</span>
                  {log.project?.name && <span className="text-primary"> · {log.project.name}</span>}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {new Date(log.performed_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-text-muted text-xs">No recent activity</div>
        )}
      </div>
    </div>
  )
}

// ─── Recent Files Widget ───────────────────────────────────────────────────
export function RecentFilesWidget({ files, onViewAll }: { files: any[], onViewAll: () => void }) {
  return (
    <div className="rounded-2xl bg-bg-secondary border border-border p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <File size={14} className="text-accent-cyan" />
          <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">Recent Files</h3>
        </div>
        <button onClick={onViewAll} className="text-[10px] uppercase tracking-widest font-semibold text-text-muted hover:text-text transition-colors">View All</button>
      </div>
      <div className="flex flex-col gap-2">
        {files && files.length > 0 ? (
          files.slice(0, 6).map((file: any) => {
            const ext = file.name?.split('.').pop()?.toLowerCase() || ''
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
            const isZip = ['zip', 'rar', 'tar'].includes(ext)
            const IconComp = isImage ? FileImage : isZip ? FileArchive : FileText
            const iconColor = isImage ? 'text-success' : ext === 'pdf' ? 'text-danger' : 'text-primary'
            const sizeKb = file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''
            return (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-bg-tertiary transition-colors cursor-pointer"
              >
                <div className={cn('w-8 h-8 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center shrink-0', iconColor)}>
                  <IconComp size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-text truncate">{file.name}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {sizeKb}{sizeKb ? ' · ' : ''}{new Date(file.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </a>
            )
          })
        ) : (
          <div className="text-center py-6 text-text-muted text-xs">No recent files</div>
        )}
      </div>
    </div>
  )
}
