'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, UploadCloud, FileText, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Project, Client, Profile } from '@/types'
import { SERVICE_TYPES } from '@/lib/utils'
import { createProject as createProjectAction, updateProject as updateProjectAction } from '@/app/actions/projects'
import { uploadMultipleFilesAction } from '@/app/actions/upload'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  client_id: z.string().optional(),
  service_type: z.string().min(1, 'Required'),
  quoted_price: z.coerce.number().min(0),
  start_date: z.string().optional(),
  expected_completion: z.string().optional(),
  team_lead_id: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'on_hold', 'delivered', 'completed']),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface ProjectModalProps {
  open: boolean
  onClose: () => void
  project: Project | null
  clients: Pick<Client, 'id' | 'name' | 'company_name'>[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
  userRole?: string
  onDelete?: (project: Project) => void
}

export default function ProjectModal({ open, onClose, project, clients, profiles, userRole, onDelete }: ProjectModalProps) {
  const supabase = createClient()
  const qc = useQueryClient()
  const isEdit = !!project
  
  const [files, setFiles] = useState<File[]>([])
  const [existingUrls, setExistingUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const teamLeads = profiles.filter(p => ['admin', 'team_lead'].includes(p.role))

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'pending', quoted_price: 0 },
  })

  useEffect(() => {
    if (open) {
      setFiles([])
      setExistingUrls(project?.deliverable_urls || [])
      reset(project ? {
        name: project.name,
        client_id: project.client_id ?? '',
        service_type: project.service_type,
        quoted_price: project.quoted_price,
        start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
        expected_completion: project.expected_completion ? new Date(project.expected_completion).toISOString().split('T')[0] : '',
        team_lead_id: project.team_lead_id ?? '',
        status: project.status,
      } : { 
        name: '', 
        client_id: '', 
        service_type: 'Website Development', 
        quoted_price: 0, 
        start_date: '', 
        expected_completion: '', 
        team_lead_id: '', 
        status: 'pending' 
      })
    }
  }, [open, project, reset])

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      client_id: data.client_id || null,
      service_type: data.service_type,
      quoted_price: data.quoted_price,
      start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
      expected_completion: data.expected_completion ? new Date(data.expected_completion).toISOString() : null,
      team_lead_id: data.team_lead_id || null,
      status: data.status,
    } as any

    setIsUploading(true)
    try {
      let uploadedUrls: string[] = []

      if (files.length > 0) {
        const formData = new window.FormData()
        files.forEach(f => formData.append('files', f))
        formData.append('folder', 'deliverables')

        const uploadResult = await uploadMultipleFilesAction(formData)
        
        if (!uploadResult.success) {
          toast.error('Failed to upload deliverable files')
          console.error(uploadResult.error)
        } else {
          uploadedUrls = uploadResult.urls || []
        }
      }
      
      payload.deliverable_urls = [...existingUrls, ...uploadedUrls]

      if (isEdit && project) {
        if (data.status === 'completed' && !project?.completion_date) {
          payload.completion_date = new Date().toISOString()
        }
        const result = await updateProjectAction(project.id, payload)
        if (!result.success) { toast.error('Failed to update project'); return }
        toast.success('Project updated')
      } else {
        const result = await createProjectAction(payload)
        if (!result.success) { toast.error('Failed to create project'); return }
        toast.success('Project created')
      }

      qc.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred. Please try again.')
      console.error('Submit error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0" />
          <motion.div
            initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text">{isEdit ? 'Edit Project' : 'New Project'}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Project Name *</label>
                <input {...register('name')} placeholder="e.g. Company Website Redesign" className={inputClass} />
                {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Client</label>
                  <select {...register('client_id')} className={inputClass}>
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Service Type *</label>
                  <select {...register('service_type')} className={inputClass}>
                    <option value="">Select service</option>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.service_type && <p className="text-xs text-danger mt-1">{errors.service_type.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Quoted Price (₹)</label>
                  <input {...register('quoted_price')} type="number" min="0" placeholder="50000" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                  <select {...register('status')} className={inputClass}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="delivered">Delivered</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Start Date</label>
                  <input {...register('start_date')} type="date" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Expected Completion</label>
                  <input {...register('expected_completion')} type="date" className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Assign Team Lead</label>
                <select {...register('team_lead_id')} className={inputClass}>
                  <option value="">Select team lead</option>
                  {teamLeads.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              {/* File Upload for Deliverables */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Final Deliverable (Optional)</label>
                
                {existingUrls.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {existingUrls.map((url, idx) => {
                      // Extract filename from our format: random_timestamp_originalName.ext
                      const urlParts = url.split('/')
                      const lastPart = urlParts[urlParts.length - 1]
                      // Try to remove the random_timestamp_ prefix if it exists, otherwise use the whole thing
                      const nameParts = lastPart.split('_')
                      const displayName = nameParts.length >= 3 ? nameParts.slice(2).join('_') : lastPart

                      return (
                        <div key={idx} className="p-3 bg-bg border border-border rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText size={16} className="text-primary shrink-0" />
                            <span className="text-sm text-text truncate" title={displayName}>{displayName}</span>
                          </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">View</a>
                          <button 
                            type="button" 
                            onClick={() => setExistingUrls(existingUrls.filter(u => u !== url))}
                            className="text-text-muted hover:text-danger"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {files.map((f, idx) => (
                      <div key={idx} className="p-3 bg-bg border border-border rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={16} className="text-text-secondary shrink-0" />
                          <span className="text-sm text-text truncate">{f.name}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                          className="text-text-muted hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(existingUrls.length > 0 || files.length > 0) ? (
                  <div className="relative group cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 mt-1 bg-bg-secondary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-sm font-medium text-text">
                    <input 
                      type="file" 
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
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
                        if (e.target.files && e.target.files.length > 0) {
                          setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
                        }
                      }}
                    />
                    <div className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform text-text-muted">
                      <UploadCloud size={18} />
                    </div>
                    <p className="text-sm font-medium text-text">
                      Click or drag files to upload
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">Upload final project files/zip</p>
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div>
                {isEdit && onDelete && project && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onDelete(project)}
                    disabled={isSubmitting || isUploading}
                    className="text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold"
                  >
                    <Trash2 size={14} />
                    <span>Delete Project</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={onClose} disabled={isSubmitting || isUploading} className="text-xs h-8 px-3">Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || isUploading} className="text-xs h-8 px-3">
                  {isSubmitting || isUploading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Project')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
