'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Invoice, Project, Client } from '@/types'
import { createInvoice, updateInvoice, deleteInvoice } from '@/app/actions/finance'

const schema = z.object({
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
  projects: Pick<Project, 'id' | 'name' | 'project_code'>[]
  clients: Pick<Client, 'id' | 'name'>[]
}

export default function InvoiceModal({ open, onClose, invoice, projects, clients }: InvoiceModalProps) {
  const qc = useQueryClient()
  const isEdit = !!invoice
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'pending', quoted_value: 0, final_billing: 0, amount_received: 0, invoice_date: new Date().toISOString().split('T')[0] },
  })

  useEffect(() => {
    if (open) {
      reset(invoice ? {
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
      } : { status: 'pending', quoted_value: 0, final_billing: 0, amount_received: 0, invoice_date: new Date().toISOString().split('T')[0] })
      setConfirmDelete(false)
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
    onClose()
  }

  const onSubmit = async (data: FormData) => {
    const payload = { 
      ...data, 
      project_id: data.project_id || null, 
      client_id: data.client_id || null, 
      payment_mode: data.payment_mode || null, 
      invoice_date: data.invoice_date ? new Date(data.invoice_date).toISOString() : new Date().toISOString(),
      due_date: data.due_date ? new Date(data.due_date).toISOString() : null, 
      payment_date: data.payment_date ? new Date(data.payment_date).toISOString() : null 
    }

    if (isEdit && invoice) {
      const result = await updateInvoice(invoice.id, payload)
      if (!result.success) { toast.error('Failed to update invoice'); return }
      toast.success('Invoice updated')
    } else {
      const result = await createInvoice(payload)
      if (!result.success) { toast.error('Failed to create invoice'); return }
      toast.success('Invoice created')
    }

    qc.invalidateQueries({ queryKey: ['invoices'] })
    onClose()
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
              <h3 className="font-semibold text-text">{isEdit ? `Edit ${invoice?.invoice_number}` : 'New Invoice'}</h3>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Project</label>
                  <select {...register('project_id')} className={inputClass}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} — {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Client</label>
                  <select {...register('client_id')} className={inputClass}>
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
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Invoice Date *</label>
                  <input {...register('invoice_date')} type="date" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Due Date</label>
                  <input {...register('due_date')} type="date" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Payment Date</label>
                  <input {...register('payment_date')} type="date" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Payment Mode</label>
                  <select {...register('payment_mode')} className={inputClass}>
                    <option value="">Select mode</option>
                    {['bank_transfer', 'upi', 'cash', 'cheque', 'card', 'other'].map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                <select {...register('status')} className={inputClass}>
                  <option value="pending">Pending</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Notes</label>
                <textarea {...register('notes')} placeholder="Any payment notes..." rows={2}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all resize-none" />
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
                <Button variant="secondary" onClick={handleClose} disabled={isDeleting} className="text-xs h-8 px-3">Cancel</Button>
                <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isDeleting} className="text-xs h-8 px-3">
                  {isSubmitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Invoice')}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
