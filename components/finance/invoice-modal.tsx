'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2, Loader2, UploadCloud, FileText, Plus, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Invoice, Project, Client } from '@/types'
import { createInvoice, updateInvoice, deleteInvoice } from '@/app/actions/finance'

const schema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required'),
  project_id: z.string().optional(),
  client_id: z.string().optional(),
  quoted_value: z.coerce.number().min(0),
  final_billing: z.coerce.number().min(0),
  amount_received: z.coerce.number().min(0),
  invoice_date: z.string().min(1),
  due_date: z.string().optional(),
  payment_date: z.string().optional(),
  payment_mode: z.string().optional(),
  status: z.enum(['paid', 'partially_paid', 'pending', 'overdue']),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface InvoiceModalProps {
  open: boolean
  onClose: () => void
  invoice: Invoice | null
  projects: Pick<Project, 'id' | 'name' | 'project_code' | 'client_id' | 'quoted_price' | 'expected_completion' | 'invoices'>[]
  clients: Pick<Client, 'id' | 'name'>[]
}

export default function InvoiceModal({ open, onClose, invoice, projects, clients }: InvoiceModalProps) {
  const qc = useQueryClient()
  const isEdit = !!invoice
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { invoice_number: '', status: 'pending', quoted_value: 0, final_billing: 0, amount_received: 0, invoice_date: new Date().toISOString().split('T')[0] },
  })

  const selectedProjectId = watch('project_id')
  const finalBilling = watch('final_billing')
  const amountReceived = watch('amount_received')
  const [projectBalance, setProjectBalance] = useState<number | null>(null)

  // Smart Status Update
  useEffect(() => {
    if (amountReceived !== undefined && amountReceived !== null && finalBilling !== undefined && finalBilling !== null) {
      if (Number(amountReceived) > 0) {
        if (Number(amountReceived) >= Number(finalBilling)) {
          setValue('status', 'paid', { shouldDirty: true })
        } else {
          setValue('status', 'partially_paid', { shouldDirty: true })
        }
      } else if (Number(amountReceived) === 0) {
        const currentStatus = getValues('status')
        if (currentStatus === 'paid' || currentStatus === 'partially_paid') {
          setValue('status', 'pending', { shouldDirty: true })
        }
      }
    }
  }, [amountReceived, finalBilling, setValue, getValues])

  // Project Balance Calculation
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId)
      if (project) {
        const totalBilled = project.invoices?.reduce((sum, inv) => sum + (inv.final_billing || 0), 0) || 0
        const quoted = project.quoted_price || 0
        setProjectBalance(quoted - totalBilled)
      }
    } else {
      setProjectBalance(null)
    }
  }, [selectedProjectId, projects])

  useEffect(() => {
    if (!isEdit && selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId)
      if (project) {
        // Auto-fill client if available
        if (project.client_id) {
          setValue('client_id', project.client_id, { shouldDirty: true })
        }
        
        // Auto-fill quotation amounts
        const quoted = project.quoted_price || 0
        setValue('quoted_value', quoted, { shouldDirty: true })
        
        // Only override final_billing if it's currently 0 or empty
        const currentFinal = getValues('final_billing')
        if (!currentFinal) {
          setValue('final_billing', quoted, { shouldDirty: true })
        }
        
        // Auto-fill due date
        if (project.expected_completion) {
          const currentDueDate = getValues('due_date')
          if (!currentDueDate) {
            setValue('due_date', new Date(project.expected_completion).toISOString().split('T')[0], { shouldDirty: true })
          }
        }
      }
    }
  }, [selectedProjectId, projects, isEdit, setValue, getValues])

  useEffect(() => {
    if (open) {
      reset(invoice ? {
        invoice_number: invoice.invoice_number ?? '',
        project_id: invoice.project_id ?? '',
        client_id: invoice.client_id ?? '',
        quoted_value: invoice.quoted_value,
        final_billing: invoice.final_billing,
        amount_received: invoice.amount_received,
        invoice_date: invoice.invoice_date ? new Date(invoice.invoice_date).toISOString().split('T')[0] : '',
        due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : '',
        payment_date: invoice.payment_date ? new Date(invoice.payment_date).toISOString().split('T')[0] : '',
        payment_mode: invoice.payment_mode ?? '',
        status: invoice.status,
        notes: invoice.notes ?? '',
      } : { 
        invoice_number: '', 
        project_id: '',
        client_id: '',
        quoted_value: 0, 
        final_billing: 0, 
        amount_received: 0, 
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        payment_date: '',
        payment_mode: '',
        status: 'pending', 
        notes: ''
      })
      setConfirmDelete(false)
      setFiles([])
    }
  }, [open, invoice, reset])

  const handleDelete = async () => {
    if (!invoice) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteInvoice(invoice.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to delete invoice')
        return
      }
      toast.success('Invoice deleted successfully')
      qc.invalidateQueries({ queryKey: ['invoices'] })
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
    setFiles([])
    onClose()
  }

  const onSubmit = async (data: FormData) => {
    setIsUploading(true)
    try {
      const formData = new window.FormData()
      formData.append('invoice_number', data.invoice_number)
      if (data.project_id) formData.append('project_id', data.project_id)
      if (data.client_id) formData.append('client_id', data.client_id)
      formData.append('quoted_value', data.quoted_value.toString())
      formData.append('final_billing', data.final_billing.toString())
      formData.append('amount_received', data.amount_received.toString())
      
      const invDate = data.invoice_date ? new Date(data.invoice_date).toISOString() : new Date().toISOString()
      formData.append('invoice_date', invDate)
      
      if (data.due_date) formData.append('due_date', new Date(data.due_date).toISOString())
      if (data.payment_date) formData.append('payment_date', new Date(data.payment_date).toISOString())
      if (data.payment_mode) formData.append('payment_mode', data.payment_mode)
      formData.append('status', data.status)
      if (data.notes) formData.append('notes', data.notes)

      files.forEach(f => formData.append('files', f))

      if (isEdit && invoice) {
        const result = await updateInvoice(invoice.id, formData)
        if (!result.success) { toast.error('Failed to update invoice'); return }
        toast.success('Invoice updated')
      } else {
        const result = await createInvoice(formData)
        if (!result.success) { toast.error('Failed to create invoice'); return }
        toast.success('Invoice created')
      }

      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    } catch (err: any) {
      toast.error(isEdit ? 'Failed to update invoice' : 'Failed to create invoice')
      console.error(err)
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
            onClick={handleClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0" />
          <motion.div
            initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text">{isEdit ? `Edit Invoice - ${invoice?.invoice_number}` : 'New Invoice'}</h3>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-text-secondary">Project</label>
                    {projectBalance !== null && (
                      <span className="text-[10px] font-medium text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">
                        Balance to Bill: <span className="text-text  tabular-nums">₹{projectBalance.toLocaleString('en-IN')}</span>
                      </span>
                    )}
                  </div>
                  <select {...register('project_id')} className={`${inputClass} pr-5`}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Client</label>
                  <select {...register('client_id')} className={`${inputClass} pr-5`}>
                    <option value="">Select client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[['quoted_value', 'Quoted (₹)'], ['final_billing', 'Final Billing (₹)'], ['amount_received', 'Received (₹)']].map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
                    <input {...register(name as keyof FormData)} type="number" min="0" placeholder="0" className={inputClass} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Invoice Number *</label>
                  <input {...register('invoice_number')} type="text" placeholder="e.g. INV-001" className={inputClass} />
                  {errors.invoice_number && <p className="text-xs text-danger mt-1">{errors.invoice_number.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Invoice Date *</label>
                  <input {...register('invoice_date')} type="date" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Due Date</label>
                  <input {...register('due_date')} type="date" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Payment Date</label>
                  <input {...register('payment_date')} type="date" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Payment Mode</label>
                  <select {...register('payment_mode')} className={`${inputClass} pr-5`}>
                    <option value="">Select Mode</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Status *</label>
                  <select {...register('status')} className={`${inputClass} pr-5`}>
                    <option value="pending">Pending</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Notes</label>
                <textarea {...register('notes')} placeholder="Any payment notes..." rows={2}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all resize-none" />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5 font-semibold">Attachments / Proof (Optional)</label>
                
                {isEdit && invoice?.file_urls && invoice.file_urls.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <label className="block text-xs font-medium text-text-secondary mb-1">Existing Files:</label>
                    {invoice.file_urls.map((url, idx) => (
                      <div key={idx} className="p-2.5 bg-bg border border-border rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={16} className="text-primary shrink-0" />
                          <span className="text-xs text-text truncate">File {idx + 1}</span>
                        </div>
                        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <ExternalLink size={12} /> View
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {files.map((f, idx) => (
                      <div key={idx} className="p-3 bg-bg border border-border rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={16} className="text-primary shrink-0" />
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

                {files.length > 0 ? (
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
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div>
                {isEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    loading={isDeleting}
                    className="text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold"
                  >
                    {!isDeleting && <Trash2 size={14} />}
                    <span>{confirmDelete ? 'Confirm Delete?' : 'Delete Invoice'}</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={handleClose} disabled={isSubmitting || isUploading || isDeleting} className="text-xs h-8 px-3">Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || isUploading} disabled={isDeleting} className="text-xs h-8 px-3">
                  {isSubmitting || isUploading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Invoice')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
