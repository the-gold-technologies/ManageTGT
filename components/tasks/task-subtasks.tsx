'use client'

import { useState } from 'react'
import { Check, Plus, Trash2, Loader2 } from 'lucide-react'
import { createSubtask, toggleSubtask, deleteSubtask } from '@/app/actions/tasks'
import type { Subtask } from '@/types'
import { toast } from 'sonner'

export function TaskSubtasks({ taskId, subtasks, isRestricted }: { taskId: string, subtasks: Subtask[], isRestricted: boolean }) {
  const [newTitle, setNewTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setIsAdding(true)
    const res = await createSubtask(taskId, newTitle)
    if (!res.success) toast.error('Failed to add subtask')
    else setNewTitle('')
    setIsAdding(false)
  }

  const handleToggle = async (subtask: Subtask) => {
    setProcessingId(subtask.id)
    const res = await toggleSubtask(subtask.id, !subtask.is_completed)
    if (!res.success) toast.error('Failed to update subtask')
    setProcessingId(null)
  }

  const handleDelete = async (id: string) => {
    setProcessingId(id)
    const res = await deleteSubtask(id)
    if (!res.success) toast.error('Failed to delete subtask')
    setProcessingId(null)
  }

  const completedCount = subtasks.filter(s => s.is_completed).length
  const totalCount = subtasks.length
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text">Subtasks</label>
        {totalCount > 0 && (
          <span className="text-xs text-text-muted">{progress}% ({completedCount}/{totalCount})</span>
        )}
      </div>

      {totalCount > 0 && (
        <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="space-y-2">
        {subtasks.map(subtask => (
          <div key={subtask.id} className="flex items-center justify-between group py-1">
            <div className="flex items-center gap-3 flex-1">
              <button
                type="button"
                disabled={processingId === subtask.id || isRestricted}
                onClick={() => handleToggle(subtask)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${subtask.is_completed ? 'bg-primary border-primary text-bg' : 'border-border bg-bg hover:border-primary/50'}`}
              >
                {processingId === subtask.id ? <Loader2 size={10} className="animate-spin text-text-muted" /> : (subtask.is_completed && <Check size={10} />)}
              </button>
              <span className={`text-sm ${subtask.is_completed ? 'text-text-muted line-through' : 'text-text'}`}>
                {subtask.title}
              </span>
            </div>
            {!isRestricted && (
              <button
                type="button"
                disabled={processingId === subtask.id}
                onClick={() => handleDelete(subtask.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!isRestricted && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="Add a subtask..."
            className="flex-1 text-sm bg-transparent border-b border-border py-1 px-1 focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newTitle.trim() || isAdding}
            className="w-6 h-6 flex items-center justify-center bg-bg-tertiary text-text hover:bg-bg-secondary rounded disabled:opacity-50 transition-colors"
          >
            {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      )}
    </div>
  )
}
