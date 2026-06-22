'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, FileDown, CheckSquare, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { parseISO, startOfDay, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear } from 'date-fns'
import type { Task, Project, Profile, TaskStatus } from '@/types'
import { getTasks, updateTaskStatus as updateTaskStatusAction } from '@/app/actions/tasks'
import { getProjects } from '@/app/actions/projects'
import { getTeamMembers } from '@/app/actions/team'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Glow } from '@/components/ui/glow'
import { formatDate, isOverdue } from '@/lib/utils'
import TaskModal from './task-modal'
import { cn } from '@/lib/utils'
import ExportDropdown from '@/components/ui/export-dropdown'
import DateFilterDropdown, { DateFilterValue } from '@/components/ui/date-filter-dropdown'

interface TasksClientProps {
  initialTasks: Task[]
  projects: Pick<Project, 'id' | 'name' | 'project_code'>[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
  userRole?: string
  userId?: string
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

export default function TasksClient({ initialTasks, projects: initialProjects, profiles: initialProfiles, userRole, userId }: TasksClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null)
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null)
  const qc = useQueryClient()

  const { data: tasksData, isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const data = await getTasks()
      return data as unknown as Task[]
    },
    refetchInterval: 15000,
  })

  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await getProjects()
      return data as unknown as Project[]
    }
  })

  const { data: profilesData, isLoading: isProfilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const data = await getTeamMembers()
      return data as unknown as Pick<Profile, 'id' | 'full_name' | 'role'>[]
    }
  })

  const isLoading = isTasksLoading || isProjectsLoading || isProfilesLoading

  // Server-side filtering logic migrated to client
  const allProjects = projectsData ?? initialProjects
  const allTasks = tasksData ?? initialTasks
  const profiles = profilesData ?? initialProfiles

  const teamLeadProjectIds = allProjects
    .filter(p => (p as Project).team_lead_id === userId)
    .map(p => p.id)

  let roleFilteredTasks = allTasks
  if (userRole === 'team_lead') {
    roleFilteredTasks = allTasks.filter(t =>
      teamLeadProjectIds.includes(t.project_id || '') ||
      t.assigned_by === userId ||
      t.assigned_to === userId
    )
  } else if (userRole === 'team_member') {
    roleFilteredTasks = allTasks.filter(t => t.assigned_to === userId)
  }

  const projects = allProjects.filter(p => ['pending', 'in_progress', 'on_hold'].includes((p as Project).status || ''))

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      let completion_date: string | undefined
      if (status === 'completed') completion_date = new Date().toISOString()
      const result = await updateTaskStatusAction(id, status, completion_date)
      if (!result.success) throw new Error(result.error)
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueryData<Task[]>(['tasks'])
      qc.setQueryData<Task[]>(['tasks'], old =>
        (old ?? []).map(t => t.id === id ? { ...t, status } : t)
      )
      return { previous }
    },
    onSuccess: () => toast.success('Task updated'),
    onError: (err, _, context) => {
      if (context?.previous) qc.setQueryData(['tasks'], context.previous)
      toast.error('Failed to update task')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const filteredTasks = (roleFilteredTasks ?? []).filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          t.project?.name.toLowerCase().includes(search.toLowerCase()) || ''
                          
    let matchesDate = true
    if (dateFilter !== 'all' && t.createdAt) {
      const expected = startOfDay(new Date(t.createdAt))
      const today = startOfDay(new Date())
      
      if (dateFilter === 'today') matchesDate = isSameDay(expected, today)
      else if (dateFilter === 'this_week') matchesDate = isSameWeek(expected, today)
      else if (dateFilter === 'this_month') matchesDate = isSameMonth(expected, today)
      else if (dateFilter === 'this_quarter') matchesDate = isSameQuarter(expected, today)
      else if (dateFilter === 'this_year') matchesDate = isSameYear(expected, today)
      else if (dateFilter === 'custom') {
        if (customDateStart && expected < startOfDay(customDateStart)) matchesDate = false
        if (customDateEnd && expected > startOfDay(customDateEnd)) matchesDate = false
      }
    } else if (dateFilter !== 'all' && !t.createdAt) {
      matchesDate = false
    }
    return matchesSearch && matchesDate
  })

  const exportHeaders = ['Title', 'Project', 'Assignee', 'Status', 'Priority', 'Deadline', 'Created At']
  const mapExportData = (t: Task) => [
    t.title,
    t.project?.name || 'N/A',
    t.assignee?.full_name || 'Unassigned',
    t.status,
    t.priority,
    t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A',
    new Date(t.createdAt).toLocaleDateString()
  ]

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="space-y-5 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Tasks</h2>
          <p className="text-sm text-text-secondary mt-0.5">{roleFilteredTasks?.length ?? 0} total tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <DateFilterDropdown 
            value={dateFilter} 
            onChange={setDateFilter} 
            onCustomDateChange={(start, end) => {
              setCustomDateStart(start)
              setCustomDateEnd(end)
              setDateFilter('custom')
            }} 
          />
          <ExportDropdown 
            data={filteredTasks} 
            headers={exportHeaders} 
            filename={`tasks_export_${new Date().toISOString().split('T')[0]}`} 
            mapData={mapExportData} 
          />
          <Button onClick={() => { setEditingTask(null); setModalOpen(true) }}>
            <Plus size={15} /> New Task
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-6 overflow-hidden min-h-[500px]">
          {[1, 2, 3, 4].map(col => (
            <div key={col} className="w-full lg:w-1/4 shrink-0 bg-bg-secondary/50 rounded-2xl p-4 border border-border">
              <div className="h-6 w-24 bg-bg-secondary rounded-md mb-4 animate-pulse"></div>
              <div className="space-y-3">
                {[1, 2, 3].map(card => (
                  <div key={card} className="h-32 bg-bg-secondary rounded-xl border border-border animate-pulse"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
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
      )}

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

