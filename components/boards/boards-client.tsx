'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, CheckSquare, AlertCircle, KanbanSquare, Calendar, FileText, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Task, Project, Profile, TaskStatus } from '@/types'
import { getTasks, updateTaskStatus as updateTaskStatusAction, updateTask as updateTaskAction } from '@/app/actions/tasks'
import TaskModal from '@/components/tasks/task-modal'
import CardMarkdownPreview from '@/components/tasks/markdown-preview'
import { getProjects } from '@/app/actions/projects'
import { getTeamMembers } from '@/app/actions/team'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Glow } from '@/components/ui/glow'
import { isOverdue } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface BoardsClientProps {
  userRole?: string
  userId?: string
}

const COLUMNS: { key: TaskStatus; label: string; color: string; headerColor: string }[] = [
  { key: 'todo', label: 'To Do', color: 'border-border-muted', headerColor: 'bg-bg-tertiary text-text-secondary' },
  { key: 'in_progress', label: 'In Progress', color: 'border-border-muted', headerColor: 'bg-info-muted text-info' },
  { key: 'review', label: 'Review', color: 'border-border-muted', headerColor: 'bg-warning-muted text-warning' },
  { key: 'completed', label: 'Completed', color: 'border-border-muted', headerColor: 'bg-success-muted text-success' },
]

const PRIORITY_BADGE_MAP = {
  low: 'muted',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
} as const

export default function BoardsClient({ userRole, userId }: BoardsClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [search, setSearch] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: tasksData = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const data = await getTasks()
      return data as unknown as Task[]
    },
    refetchInterval: 15000,
  })

  const { data: projectsData = [], isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await getProjects()
      return data as unknown as Project[]
    }
  })

  const { data: profilesData = [], isLoading: isProfilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const data = await getTeamMembers()
      return data as unknown as Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_url'>[]
    }
  })

  const updateDescription = useMutation({
    mutationFn: async ({ id, description }: { id: string, description: string }) => {
      return updateTaskAction(id, { description })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  const isLoading = isTasksLoading || isProjectsLoading || isProfilesLoading

  // Server-side filtering logic migrated to client
  const teamLeadProjectIds = projectsData
    .filter(p => p.team_lead_id === userId)
    .map(p => p.id)

  let roleFilteredTasks = tasksData
  if (userRole === 'team_lead') {
    roleFilteredTasks = tasksData.filter(t =>
      teamLeadProjectIds.includes(t.project_id || '') ||
      t.assigned_by === userId ||
      t.assigned_member_ids?.includes(userId || '')
    )
  } else if (userRole === 'team_member') {
    roleFilteredTasks = tasksData.filter(t => t.assigned_member_ids?.includes(userId || ''))
  }

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
    onSuccess: () => toast.success('Task status updated'),
    onError: (err, _, context) => {
      if (context?.previous) qc.setQueryData(['tasks'], context.previous)
      toast.error('Failed to update task')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  // Filtering based on search and selected project
  const filteredTasks = roleFilteredTasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase())
    const matchesProject = selectedProjectId === 'all' || t.project_id === selectedProjectId
    return matchesSearch && matchesProject
  })

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    // For Firefox compatibility
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    if (!draggedTaskId) return

    const task = tasksData.find(t => t.id === draggedTaskId)
    if (task && task.status !== status) {
      updateStatus.mutate({ id: draggedTaskId, status })
    }
    setDraggedTaskId(null)
  }

  return (
    <div className="space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            Project Boards
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">Manage tasks visually across your projects</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search board..."
              className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-all max-w-[200px]"
          >
            <option value="all">All Projects</option>
            {projectsData.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button onClick={() => { setEditingTask(null); setModalOpen(true) }}>
            <Plus size={15} /> Add Task
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
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px] overflow-hidden">
          {COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.key)
          return (
            <div 
              key={col.key} 
              className={cn('rounded-xl border bg-bg-secondary flex flex-col', col.color)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className={cn('flex items-center justify-between px-4 py-3 rounded-t-xl shrink-0', col.headerColor)}>
                <span className="text-xs font-semibold">{col.label}</span>
                <span className="text-xs font-bold bg-bg/50 px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                    <CheckSquare size={24} className="text-text-muted mb-2" />
                    <p className="text-xs text-text-muted">No tasks</p>
                  </div>
                )}
                {colTasks.map(task => {
                  const overdue = isOverdue(task.deadline) && task.status !== 'completed'
                  const assignees = profilesData.filter(p => task.assigned_member_ids?.includes(p.id))
                  
                  return (
                    <motion.div
                      key={task.id}
                      draggable
                      onDragStart={(e: any) => handleDragStart(e, task.id)}
                      variants={itemVariants}
                      className={cn(
                        "relative bg-bg border rounded-lg p-3 hover:border-border-muted transition-all cursor-grab active:cursor-grabbing group",
                        draggedTaskId === task.id ? 'opacity-50 border-primary' : 'border-border'
                      )}
                      onClick={() => { setEditingTask(task); setModalOpen(true) }}
                    >
                      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                        <Glow />
                      </div>
                      <div className="relative z-10 pointer-events-auto">
                        {/* Top Row: Project Left, Priority Right */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          {task.project ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-medium text-primary bg-primary/10 pr-1.5 py-0.5 rounded-sm shrink-0">
                                {task.project.project_code}
                              </span>
                              <span className="text-[10px] text-text-muted truncate">
                                {task.project.name}
                              </span>
                            </div>
                          ) : <div />}
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {overdue && (
                              <AlertCircle size={12} className="text-danger" />
                            )}
                            <Badge variant={PRIORITY_BADGE_MAP[task.priority]} className="text-[10px]">
                              {task.priority}
                            </Badge>
                          </div>
                        </div>

                        {/* Title */}
                        <p className="text-xs font-normal text-text mb-1 leading-tight">{task.title}</p>

                        {/* Description Preview */}
                        {task.description && (
                          <CardMarkdownPreview 
                            source={task.description} 
                            onUpdate={(newDesc) => updateDescription.mutate({ id: task.id, description: newDesc })} 
                          />
                        )}

                        {/* File Previews */}
                        {task.files && task.files.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {task.files.map(file => {
                              const isImage = /\.(png|jpe?g|gif|webp)$/i.test(file.file_url)
                              return isImage ? (
                                <div 
                                  key={file.id} 
                                  className="w-10 h-10 rounded-md border border-border overflow-hidden cursor-zoom-in bg-bg-tertiary shrink-0 hover:border-primary transition-all z-10" 
                                  title={file.file_name}
                                  onClick={(e) => { e.stopPropagation(); setPreviewImage(file.file_url) }}
                                >
                                  <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div key={file.id} className="w-10 h-10 rounded-md border border-border bg-bg-tertiary flex items-center justify-center shrink-0" title={file.file_name}>
                                  <FileText size={16} className="text-text-muted" />
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Bottom row */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          {assignees.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {assignees.slice(0, 5).map((assignee, idx) => (
                                <div key={assignee.id} title={assignee.full_name} className="w-5 h-5 rounded-full text-primary flex items-center justify-center text-[9px] font-bold uppercase ring-1 ring-border-muted relative z-10 hover:z-20 transition-all bg-bg overflow-hidden">
                                  {assignee.avatar_url && (
                                    <img 
                                      src={assignee.avatar_url} 
                                      alt={assignee.full_name} 
                                      className="w-full h-full object-cover absolute inset-0 z-10" 
                                      referrerPolicy="no-referrer"
                                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                  )}
                                  <span className="relative z-0">{assignee.full_name.charAt(0)}</span>
                                </div>
                              ))}
                              {assignees.length > 5 && (
                                <div className="w-5 h-5 rounded-full text-text-secondary flex items-center justify-center text-[9px] font-bold uppercase ring-1 ring-border relative z-10 bg-bg">
                                  +{assignees.length - 5}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-text-muted italic">Unassigned</span>
                          )}
                          
                          {task.deadline && (
                            <div className={cn('flex items-center gap-1 text-[10px] font-medium', overdue ? 'text-danger' : 'text-text-muted')}>
                              <Calendar size={12} />
                              <span>{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                          )}
                        </div>
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

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out !m-0"
            onClick={() => setPreviewImage(null)}
          >
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={previewImage}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null) }}
        task={editingTask}
        projects={projectsData}
        profiles={profilesData}
        userRole={userRole}
      />
    </div>
  )
}
