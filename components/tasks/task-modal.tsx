'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Paperclip, Loader2, FileText, Download, Trash2, Plus, ChevronDown, Check, MessageSquare, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Task, Project, Profile, TaskFile } from '@/types'
import { createTask, updateTask, deleteTask, getTaskActivity, logActivity, addTaskFile, deleteTaskFile, createSubtask, toggleSubtask, deleteSubtask, addTaskComment } from '@/app/actions/tasks'
import { uploadFileAction } from '@/app/actions/upload'
import dynamic from 'next/dynamic'
import '@uiw/react-md-editor/markdown-editor.css'
import { format as formatDate } from 'date-fns'

const CustomEditor = dynamic(() => import('./custom-editor'), { ssr: false })

const schema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  project_id: z.string().optional(),
  assigned_member_ids: z.array(z.string()).optional(),
  deadline: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'review', 'completed']),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface TaskModalProps {
  open: boolean
  onClose: () => void
  task: Task | null
  projects: Pick<Project, 'id' | 'name' | 'project_code'>[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
  userRole?: string
}

export default function TaskModal({ open, onClose, task, projects, profiles, userRole }: TaskModalProps) {
  const supabase = createClient()
  const qc = useQueryClient()
  const isEdit = !!task
  const isRestricted = userRole === 'team_member'
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false)

  const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium', status: 'todo' },
  })

  useEffect(() => {
    if (open) {
      reset(task ? {
        title: task.title,
        description: task.description ?? '',
        project_id: task.project_id ?? '',
        assigned_member_ids: task.assigned_member_ids ?? [],
        deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
        priority: task.priority,
        status: task.status,
      } : { 
        title: '',
        description: '',
        project_id: '',
        assigned_member_ids: [],
        deadline: '',
        priority: 'medium', 
        status: 'todo' 
      })
      // Delay resetting state to avoid sync state updates in effect
      setTimeout(() => {
        setSelectedFiles([])
        setConfirmDelete(false)
      }, 0)
    }
  }, [open, task, reset])

  const onSubmit = async (data: FormData) => {
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      title: data.title,
      description: data.description || null,
      project_id: data.project_id || null,
      assigned_member_ids: data.assigned_member_ids || [],
      assigned_by: user?.id,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      priority: data.priority,
      status: data.status,
    }

    let targetTaskId = isEdit && task ? task.id : ''

    try {
      if (isEdit && task) {
      const result = await updateTask(task.id, payload)
      if (!result.success) { toast.error('Failed to update task'); return }
      // Log activity
      await logActivity({
        task_id: task.id, action: 'Task Updated'
      })
      toast.success('Task updated')
    } else {
      const result = await createTask(payload)
      if (!result.success) { toast.error('Failed to create task'); return }
      await logActivity({
        task_id: result.task?.id || '', action: 'Task Created'
      })
      toast.success('Task created')
      targetTaskId = result.task?.id || ''
    }

    if (targetTaskId && selectedFiles.length > 0) {
      setUploadingFiles(true)
      for (const file of selectedFiles) {
        const formData = new window.FormData()
        formData.append('file', file)
        formData.append('folder', `tasks/${targetTaskId}`)
        
        const uploadResult = await uploadFileAction(formData)
        
        if (uploadResult.success) {
          await addTaskFile({
            task_id: targetTaskId,
            file_name: file.name,
            file_url: uploadResult.url,
            file_size: file.size
          })
        }
      }
        setUploadingFiles(false)
      }

      qc.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred. Please try again.')
      console.error('Submit error:', err)
      setUploadingFiles(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteTask(task.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to delete task')
        return
      }
      toast.success('Task deleted successfully')
      qc.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.')
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleClose = () => {
    setConfirmDelete(false)
    onClose()
  }

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0" />
          <motion.div
            initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-text">{isEdit ? 'Edit Task' : 'New Task'}</h3>
                {isEdit && task?.createdAt && (
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted bg-bg-tertiary px-2 py-1 rounded-md">
                    <Clock size={12} />
                    <span>Created {formatDate(new Date(task.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Task Title *</label>
                <input {...register('title')} placeholder="What needs to be done?" className={inputClass} disabled={isRestricted} />
                {errors.title && <p className="text-xs text-danger mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <CustomEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={isRestricted}
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Project</label>
                  <select {...register('project_id')} className={inputClass} disabled={isRestricted}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Assign To</label>
                  <button 
                    type="button" 
                    disabled={isRestricted}
                    onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                  >
                    <span className="truncate">
                      {(() => {
                        const selectedIds = watch('assigned_member_ids') || []
                        if (selectedIds.length === 0) return <span className="text-text-muted">Unassigned</span>
                        if (selectedIds.length === 1) return profiles.find(p => p.id === selectedIds[0])?.full_name || '1 selected'
                        return `${selectedIds.length} selected`
                      })()}
                    </span>
                    <ChevronDown size={14} className={cn("text-text-muted transition-transform", isAssigneeOpen && "rotate-180")} />
                  </button>
                  
                  <AnimatePresence>
                    {isAssigneeOpen && !isRestricted && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-[calc(100%+4px)] left-0 w-full bg-bg border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar py-1"
                      >
                        {profiles.map(p => {
                          const isSelected = watch('assigned_member_ids')?.includes(p.id)
                          return (
                            <label key={p.id} className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-tertiary transition-all">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" value={p.id} className="hidden" 
                                  {...register('assigned_member_ids')} 
                                />
                                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold uppercase ring-1 ring-primary/30 shrink-0">
                                  {p.full_name.substring(0, 2)}
                                </div>
                                <span className="text-xs text-text">{p.full_name}</span>
                              </div>
                              {isSelected && <Check size={14} className="text-primary" />}
                            </label>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Priority</label>
                  <select {...register('priority')} className={inputClass} disabled={isRestricted}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                  <select {...register('status')} className={inputClass}>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Deadline</label>
                <input {...register('deadline')} type="date" className={inputClass} disabled={isRestricted} />
              </div>

              {/* Attachments Section */}
              <div className="pt-2 border-t border-border mt-4">
                <label className="block text-xs font-medium text-text-secondary mb-3">Attachments</label>
                
                {/* Existing Files */}
                {isEdit && task?.files && task.files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {task.files.map(f => {
                      const isImage = !!f.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                      const isPdf = !!f.file_name.match(/\.pdf$/i)
                      const sizeStr = f.file_size ? `${(f.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'

                      return (
                        <div key={f.id} className="flex items-center gap-3 p-2 rounded-xl bg-bg-secondary border border-border">
                          <div className="w-12 h-12 rounded-lg bg-bg border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                            {isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover" />
                            ) : isPdf ? (
                              <div className="text-danger flex flex-col items-center justify-center">
                                <FileText size={18} />
                                <span className="text-[8px] font-bold uppercase mt-0.5">PDF</span>
                              </div>
                            ) : (
                              <FileText size={18} className="text-text-muted" />
                            )}
                          </div>
                          
                          <div className="flex-1 overflow-hidden">
                            <a href={f.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-text hover:text-primary truncate block transition-colors">
                              {f.file_name}
                            </a>
                            <p className="text-xs text-text-muted">{sizeStr}</p>
                          </div>

                          <a href={f.file_url} target="_blank" download className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text transition-colors shrink-0">
                            <Download size={16} />
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}

                    {/* Upload Zone */}
                {((isEdit && task?.files && task.files.length > 0) || selectedFiles.length > 0) ? (
                  <div className="relative group cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 mt-1 bg-bg-secondary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-sm font-medium text-text">
                    <input 
                      type="file" 
                      multiple 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files) {
                          setSelectedFiles((prev: File[]) => [...prev, ...Array.from(e.target.files!)])
                        }
                      }}
                    />
                    <Plus size={16} className="text-text-muted" /> Add more files
                  </div>
                ) : (
                  <div className="relative border border-dashed border-[#A3A3A3] dark:border-[#333333] rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-primary/50 transition-colors bg-bg/50">
                    <input 
                      type="file" 
                      multiple 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files) {
                          setSelectedFiles((prev: File[]) => [...prev, ...Array.from(e.target.files!)])
                        }
                      }}
                    />
                    <Paperclip size={18} className="text-text-muted mb-2" />
                    <span className="text-sm font-medium text-text">Click to upload files</span>
                    <span className="text-xs text-text-muted mt-1">or drag and drop</span>
                  </div>
                )}

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {selectedFiles.map((file: File, i: number) => {
                      const isImage = file.type.startsWith('image/')
                      const isPdf = file.type === 'application/pdf'
                      const sizeStr = `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      
                      // Create a temporary object URL for preview
                      const previewUrl = isImage || isPdf ? URL.createObjectURL(file) : ''

                      return (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-bg-secondary border border-border relative overflow-hidden group">
                          {/* Upload Progress Overlay (Simulated) */}
                          {uploadingFiles && (
                            <div className="absolute inset-0 bg-bg/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                              <Loader2 size={16} className="text-primary animate-spin" />
                            </div>
                          )}

                          <div className="w-12 h-12 rounded-lg bg-bg border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                            {isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                            ) : isPdf ? (
                              <div className="text-danger flex flex-col items-center justify-center relative w-full h-full group-hover:opacity-20 transition-opacity">
                                <FileText size={18} />
                                <span className="text-[8px] font-bold uppercase mt-0.5">PDF</span>
                              </div>
                            ) : (
                              <FileText size={18} className="text-text-muted" />
                            )}
                            
                            {/* If PDF, show small iframe preview on hover? Too heavy. Let's stick to the nice icon. */}
                          </div>
                          
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-text truncate">{file.name}</p>
                            <p className="text-xs text-text-muted">{sizeStr}</p>
                          </div>

                          <button 
                            type="button" 
                            disabled={uploadingFiles}
                            onClick={() => setSelectedFiles((prev: File[]) => prev.filter((_: File, index: number) => index !== i))} 
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Removed Subtasks and Activity Logs */}
            </form>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="flex items-center gap-4">
                {isEdit && !isRestricted && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    loading={isDeleting}
                    className="text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold"
                  >
                    {!isDeleting && <Trash2 size={14} />}
                    <span>{confirmDelete ? 'Confirm Delete?' : 'Delete Task'}</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={handleClose} disabled={isDeleting} className="text-xs h-8 px-3">Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || uploadingFiles} disabled={isDeleting} className="text-xs h-8 px-3">
                  {isSubmitting || uploadingFiles ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Task')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Need to import cn in this file
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}
