'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2, UploadCloud, FileText, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient as createClientAction, updateClient as updateClientAction } from '@/app/actions/clients'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Client } from '@/types'
import { uploadMultipleFilesAction } from '@/app/actions/upload'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  company_name: z.string().optional(),
  contact_person: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ClientModalProps {
  open: boolean
  onClose: () => void
  client: Client | null
  onDelete?: (client: Client) => void
}

const FIELDS = [
  { name: 'name' as const, label: 'Client Name *', placeholder: 'e.g. Rahul Sharma', required: true },
  { name: 'company_name' as const, label: 'Company Name', placeholder: 'e.g. TechCorp Pvt Ltd' },
  { name: 'contact_person' as const, label: 'Contact Person', placeholder: 'Primary contact' },
  { name: 'mobile' as const, label: 'Mobile Number', placeholder: '+91 98765 43210' },
  { name: 'email' as const, label: 'Email Address', placeholder: 'client@company.com', type: 'email' },
  { name: 'address' as const, label: 'Office Address', placeholder: 'Full address', fullWidth: true },
  { name: 'gst_number' as const, label: 'GST Number', placeholder: '22AAAAA0000A1Z5' },
  { name: 'pan_number' as const, label: 'PAN Number (Optional)', placeholder: 'AAAAA0000A' },
  { name: 'notes' as const, label: 'Notes / Remarks', placeholder: 'Any additional notes...', fullWidth: true, textarea: true },
]

export default function ClientModal({ open, onClose, client, onDelete }: ClientModalProps) {
  const qc = useQueryClient()
  const isEdit = !!client

  const [files, setFiles] = useState<File[]>([])
  const [existingUrls, setExistingUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset(client ? {
        name: client.name,
        company_name: client.company_name ?? '',
        contact_person: client.contact_person ?? '',
        mobile: client.mobile ?? '',
        email: client.email ?? '',
        address: client.address ?? '',
        gst_number: client.gst_number ?? '',
        pan_number: client.pan_number ?? '',
        notes: client.notes ?? '',
      } : {
        name: '',
        company_name: '',
        contact_person: '',
        mobile: '',
        email: '',
        address: '',
        gst_number: '',
        pan_number: '',
        notes: '',
      })
      setExistingUrls(client?.document_urls ?? [])
      setFiles([])
    }
  }, [open, client, reset])

  const onSubmit = async (data: FormData) => {
    setIsUploading(true)
    try {
      let uploadedUrls: string[] = []

      if (files.length > 0) {
        const formData = new window.FormData()
        files.forEach(f => formData.append('files', f))
        formData.append('folder', 'clients')

        const uploadResult = await uploadMultipleFilesAction(formData)
        if (!uploadResult.success) {
          toast.error('Failed to upload documents')
          console.error(uploadResult.error)
        } else {
          uploadedUrls = uploadResult.urls || []
        }
      }

      const payload = {
        ...data,
        document_urls: [...existingUrls, ...uploadedUrls]
      }

      if (isEdit && client) {
        const result = await updateClientAction(client.id, payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Client updated')
      } else {
        const result = await createClientAction(payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Client created')
      }

      qc.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    } catch (err: any) {
      toast.error('An error occurred during submission')
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0"
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text">{isEdit ? 'Edit Client' : 'Add New Client'}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                {FIELDS.map(field => (
                  <div key={field.name} className={field.fullWidth ? 'col-span-2' : 'col-span-1'}>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      {field.label}
                    </label>
                    {field.textarea ? (
                      <textarea
                        {...register(field.name)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                      />
                    ) : (
                      <input
                        {...register(field.name)}
                        type={field.type ?? 'text'}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                    )}
                    {errors[field.name] && (
                      <p className="text-xs text-danger mt-1">{errors[field.name]?.message}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Document Upload Area */}
              <div className="pt-4">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Client Documents (Optional)
                </label>

                {existingUrls.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {existingUrls.map((url, idx) => {
                      const urlParts = url.split('/')
                      const lastPart = urlParts[urlParts.length - 1]
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
                      )
                    })}
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
                    <p className="text-sm font-medium text-text">Click or drag files to upload</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Upload client contract, project briefs, etc.</p>
                  </div>
                )}
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg">
              <div>
                {isEdit && onDelete && client && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onDelete(client)}
                    disabled={isSubmitting || isUploading}
                    className="text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold"
                  >
                    <Trash2 size={14} />
                    <span>Delete Client</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={onClose} disabled={isSubmitting || isUploading} className="text-xs h-8 px-3">Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || isUploading} className="text-xs h-8 px-3">
                  {isSubmitting || isUploading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Client')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
