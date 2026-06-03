'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { addTeamMember } from '@/app/actions/team'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

const schema = z.object({
  full_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().optional(),
  role: z.enum(['admin', 'team_lead', 'team_member', 'sales_executive']),
})

type FormData = z.infer<typeof schema>

interface TeamModalProps {
  open: boolean
  onClose: () => void
  userRole: string
  member: Profile | null
}

export default function TeamModal({ open, onClose, userRole, member }: TeamModalProps) {
  const qc = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)

  const isRestricted = userRole === 'team_lead'
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'team_member' }
  })

  useEffect(() => {
    if (open) {
      reset({ 
        role: member?.role || 'team_member', 
        full_name: member?.full_name || '', 
        email: member?.email || '', 
        password: '' 
      })
      setShowPassword(false)
    }
  }, [open, member, reset])
  
  const onSubmit = async (data: FormData) => {
    if (isRestricted) {
      data.role = 'team_member'
    }

    if (!member && !data.password) {
      toast.error('Password is required for new members')
      return
    }

    let res
    if (member) {
      const { updateTeamMember } = await import('@/app/actions/team')
      res = await updateTeamMember(member.id, data)
    } else {
      res = await addTeamMember(data)
    }

    if (res.error) {
      toast.error(res.error)
      return
    }

    toast.success(member ? 'Member updated successfully' : 'Member added successfully')
    qc.invalidateQueries({ queryKey: ['team'] })
    onClose()
  }

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0"
          />
          <motion.div
            initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text">{member ? 'Edit Member' : 'Add New Member'}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name *</label>
                <input
                  {...register('full_name')}
                  placeholder="e.g. John Doe"
                  className={inputClass}
                />
                {errors.full_name && (
                  <p className="text-xs text-danger mt-1">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Email *</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="john@example.com"
                  className={inputClass}
                />
                {errors.email && (
                  <p className="text-xs text-danger mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">{member ? 'New Password (optional)' : 'Initial Password *'}</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={member ? 'Leave blank to keep current password' : 'Enter a secure password'}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-danger mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Role</label>
                <select
                  {...register('role')}
                  className={inputClass}
                  disabled={isRestricted}
                >
                  <option value="admin">Admin</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="sales_executive">Sales Executive</option>
                  <option value="team_member">Team Member</option>
                </select>
                {isRestricted && (
                  <p className="text-xs text-text-muted mt-1">You can only add Team Members.</p>
                )}
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
                {member ? 'Save Changes' : 'Add Member'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
