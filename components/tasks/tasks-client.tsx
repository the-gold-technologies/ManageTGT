'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, FileDown, CheckSquare, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { parseISO, startOfDay } from 'date-fns'
import type { Task, Project, Profile, TaskStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Glow } from '@/components/ui/glow'
import { formatDate, isOverdue } from '@/lib/utils'
import TaskModal from './task-modal'
import { cn } from '@/lib/utils'

interface TasksClientProps {
  initialTasks: Task[]
  projects: Pick<Project, 'id' | 'name' | 'project_code'>[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
  userRole?: string
}

const COLUMNS: { key: TaskStatus; label: string; color: string; headerColor: string }[] = [
  { key: 'todo', label: 'To Do', color: 'border-border-muted', headerColor: 'bg-bg-tertiary text-text-secondary' },
  { key: 'in_progress', label: 'In Progress', color: 'border-info/30', headerColor: 'bg-info-muted text-info' },
  { key: 'review', label: 'Review', color: 'border-warning/30', headerColor: 'bg-warning-muted text-warning' },
  { key: 'completed', label: 'Completed', color: 'border-success/30', headerColor: 'bg-success-muted text-success' },
]

const PRIORITY_BADGE_MAP = {
  low: 'muted',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
} as const

export default function TasksClient({ initialTasks, projects, profiles, userRole }: TasksClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue'>('all')
  const qc = useQueryClient()
  const supabase = createClient()

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(id,full_name), assigner:profiles!tasks_assigned_by_fkey(id,full_name), project:projects(id,name,project_code), files:task_files(*)')
        .order('created_at', { ascending: false })
      return data as Task[]
    },
    initialData: initialTasks,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const payload: Record<string, unknown> = { status }
      if (status === 'completed') payload.completion_date = new Date().toISOString()
      const { error } = await supabase.from('tasks').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task updated')
    },
    onError: () => toast.error('Failed to update task'),
  })

  const filteredTasks = (tasks ?? []).filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          t.project?.name.toLowerCase().includes(search.toLowerCase()) || ''
                          
    let matchesDate = true
    if (dateFilter !== 'all' && t.deadline) {
      const deadline = startOfDay(parseISO(t.deadline))
      const today = startOfDay(new Date())
      if (dateFilter === 'today') matchesDate = deadline.getTime() === today.getTime()
      if (dateFilter === 'upcoming') matchesDate = deadline.getTime() > today.getTime()
      if (dateFilter === 'overdue') matchesDate = deadline.getTime() < today.getTime() && t.status !== 'completed'
    } else if (dateFilter !== 'all' && !t.deadline) {
      matchesDate = false
    }
    return matchesSearch && matchesDate
  })

  const exportToCSV = () => {
    const headers = ['Title', 'Project', 'Assignee', 'Status', 'Priority', 'Deadline', 'Created At']
    const rows = filteredTasks.map(t => [
      t.title,
      t.project?.name || 'N/A',
      t.assignee?.full_name || 'Unassigned',
      t.status,
      t.priority,
      t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A',
      new Date(t.created_at).toLocaleDateString()
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="space-y-5 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Tasks</h2>
          <p className="text-sm text-text-secondary mt-0.5">{tasks?.length ?? 0} total tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'upcoming' | 'overdue')}
            className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
          </select>
          <Button variant="secondary" onClick={exportToCSV}><FileDown size={15} className="mr-2" /> Export</Button>
          <Button onClick={() => { setEditingTask(null); setModalOpen(true) }}>
            <Plus size={15} /> New Task
          </Button>
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[500px]">
        {COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.key)
          return (
            <div key={col.key} className={cn('rounded-xl border bg-bg-secondary flex flex-col', col.color)}>
              <div className={cn('flex items-center justify-between px-4 py-3 rounded-t-xl', col.headerColor)}>
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-xs font-bold">{colTasks.length}</span>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                    <CheckSquare size={24} className="text-text-muted mb-2" />
                    <p className="text-xs text-text-muted">No tasks</p>
                  </div>
                )}
                {colTasks.map(task => {
                  const overdue = isOverdue(task.deadline) && task.status !== 'completed'
                  return (
                    <motion.div
                      key={task.id}
                      variants={itemVariants}
                      className="relative overflow-hidden bg-bg border border-border rounded-lg p-3 hover:border-border-muted transition-all cursor-pointer group"
                      onClick={() => { setEditingTask(task); setModalOpen(true) }}
                    >
                      <Glow />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant={PRIORITY_BADGE_MAP[task.priority]} className="text-[10px]">
                            {task.priority}
                          </Badge>
                          {overdue && (
                            <AlertCircle size={12} className="text-danger shrink-0 mt-0.5" />
                          )}
                        </div>

                        {/* Title */}
                        <p className="text-sm font-medium text-text mb-2 leading-snug">{task.title}</p>

                        {/* Project */}
                        {task.project && (
                          <p className="text-[10px] text-text-muted mb-2">{task.project.project_code} · {task.project.name}</p>
                        )}

                        {/* Bottom row */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                          {task.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                                {task.assignee.full_name.charAt(0)}
                              </div>
                              <span className="text-[10px] text-text-muted">{task.assignee.full_name.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-text-muted">Unassigned</span>
                          )}
                          {task.deadline && (
                            <span className={cn('text-[10px]', overdue ? 'text-danger font-semibold' : 'text-text-muted')}>
                              {formatDate(task.deadline)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status move buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter(c => c.key !== col.key).map(c => (
                          <button
                            key={c.key}
                            onClick={e => { e.stopPropagation(); updateStatus.mutate({ id: task.id, status: c.key }) }}
                            className="text-[10px] px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary hover:text-text transition-colors border border-border"
                          >
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </motion.div>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        projects={projects}
        profiles={profiles}
        userRole={userRole}
      />
    </div>
  )
}
