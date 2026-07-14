'use client'

import { useState } from 'react'
import { MessageSquare, Loader2, Send } from 'lucide-react'
import { addTaskComment } from '@/app/actions/tasks'
import type { ActivityLog } from '@/types'
import { toast } from 'sonner'
import { format as formatDate } from 'date-fns'

export function TaskActivity({ taskId, logs, isRestricted }: { taskId: string, logs: ActivityLog[], isRestricted: boolean }) {
  const [comment, setComment] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!comment.trim()) return
    setIsAdding(true)
    const res = await addTaskComment(taskId, comment)
    if (!res.success) toast.error('Failed to post comment')
    else setComment('')
    setIsAdding(false)
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-text-muted" />
        <label className="text-xs font-semibold text-text">Activity & Comments</label>
      </div>

      <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
        {logs.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">No activity yet</p>
        ) : (
          logs.map(log => {
            const isComment = log.action === 'commented'
            const commentText = (log.metadata as any)?.comment

            return (
              <div key={log.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {log.performer?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text">
                      {log.performer?.full_name || 'System'}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {formatDate(new Date(log.performed_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {isComment ? (
                    <div className="mt-1 p-2.5 rounded-xl bg-bg-secondary border border-border text-xs text-text whitespace-pre-wrap">
                      {commentText}
                    </div>
                  ) : (
                    <p className="text-[11px] text-text-muted mt-0.5">{log.action}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {!isRestricted && (
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!comment.trim() || isAdding}
            className="w-10 h-10 flex items-center justify-center bg-primary text-bg hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors shrink-0"
          >
            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      )}
    </div>
  )
}
