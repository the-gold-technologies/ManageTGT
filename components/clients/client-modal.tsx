'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient as createClientAction, updateClient as updateClientAction } from '@/app/actions/clients'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Client } from '@/types'

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

export default function ClientModal({ open, onClose, client }: ClientModalProps) {
  const qc = useQueryClient()
  const isEdit = !!client

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
      } : {})
    }
  }, [open, client, reset])

  const onSubmit = async (data: FormData) => {
    const payload = { ...data }

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
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
                {isEdit ? 'Save Changes' : 'Add Client'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
