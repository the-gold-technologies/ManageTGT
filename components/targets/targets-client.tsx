'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Target, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { SalesTarget, SalesClosure, Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { SERVICE_TYPES } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { upsertTarget as upsertTargetAction, getSalesTargets, getSalesClosures } from '@/app/actions/targets'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const targetSchema = z.object({
  service_type: z.string().min(1),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number(),
  target_count: z.coerce.number().min(1),
})

type TargetFormInput = z.input<typeof targetSchema>
type TargetFormData = z.output<typeof targetSchema>

interface TargetsClientProps {
  initialTargets: SalesTarget[]
  initialClosures: SalesClosure[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
}

export default function TargetsClient({ initialTargets, initialClosures, profiles }: TargetsClientProps) {
  const [addTargetOpen, setAddTargetOpen] = useState(false)
  const qc = useQueryClient()
  const supabase = createClient()
  const now = new Date()

  const { data: targets } = useQuery({
    queryKey: ['sales_targets'],
    queryFn: async () => {
      const data = await getSalesTargets()
      return data.filter((t: any) => t.year === now.getFullYear()) as unknown as SalesTarget[]
    },
    initialData: initialTargets,
  })

  const { data: closures } = useQuery({
    queryKey: ['sales_closures'],
    queryFn: async () => {
      const data = await getSalesClosures()
      return data as any[]
    },
    initialData: initialClosures,
  })

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<TargetFormInput, undefined, TargetFormData>({
    resolver: zodResolver(targetSchema),
    defaultValues: { month: now.getMonth() + 1, year: now.getFullYear(), target_count: 10 },
  })

  const onSubmitTarget = async (data: TargetFormData) => {
    const result = await upsertTargetAction(data)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Target set!')
    qc.invalidateQueries({ queryKey: ['sales_targets'] })
    setAddTargetOpen(false)
    reset()
  }

  // Group closures by target
  const closuresByTarget = (closures ?? []).reduce((acc, c) => {
    if (!acc[c.target_id]) acc[c.target_id] = 0
    acc[c.target_id]++
    return acc
  }, {} as Record<string, number>)

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Sales Targets — {now.getFullYear()}</h2>
          <p className="text-sm text-text-secondary mt-0.5">Monthly service-wise targets and achievements</p>
        </div>
        <Button onClick={() => setAddTargetOpen(true)}><Plus size={15} /> Set Target</Button>
      </div>

      {/* Targets grid */}
      {(targets ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No targets set yet</p>
          <p className="text-sm text-text-muted mt-1">Set monthly targets to track your sales team performance</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(targets ?? []).map(t => {
            const achieved = closuresByTarget[t.id] ?? 0
            const remaining = Math.max(0, t.target_count - achieved)
            const pct = t.target_count > 0 ? Math.min(Math.round((achieved / t.target_count) * 100), 100) : 0
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-muted transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-text text-sm">{t.service_type}</p>
                    <p className="text-xs text-text-muted">{MONTHS[t.month - 1]} {t.year}</p>
                  </div>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', pct >= 100 ? 'bg-success-muted text-success' : pct >= 60 ? 'bg-warning-muted text-warning' : 'bg-danger-muted text-danger')}>
                    {pct}%
                  </span>
                </div>

                <div className="flex items-end gap-2 mb-3">
                  <span className="text-3xl font-bold text-text">{achieved}</span>
                  <span className="text-text-muted text-sm pb-1">/ {t.target_count}</span>
                </div>

                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : pct >= 60 ? 'bg-primary' : 'bg-warning')}
                  />
                </div>

                <div className="flex justify-between text-xs text-text-muted">
                  <span>Achieved: <span className="text-text font-medium">{achieved}</span></span>
                  <span>Remaining: <span className="text-text font-medium">{remaining}</span></span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Recent closures */}
      {(closures ?? []).length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-bg-tertiary border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-text">Recent Closures</h3>
          </div>
          <div className="divide-y divide-border">
            {(closures ?? []).slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 bg-bg-secondary hover:bg-bg-tertiary transition-colors">
                <div>
                  <p className="text-sm font-medium text-text">{(c.closer as any)?.full_name ?? 'Unknown'}</p>
                  <p className="text-xs text-text-muted">{(c.client as any)?.name ?? 'No client'}</p>
                </div>
                <span className="text-xs text-text-muted">{formatDateTime(c.closed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add target modal */}
      <AnimatePresence>
        {addTargetOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAddTargetOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0" />
            <motion.div
              initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-text">Set Monthly Target</h3>
                <button onClick={() => setAddTargetOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmitTarget)} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Service Type</label>
                  <select {...register('service_type')} className={inputClass}>
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Month</label>
                    <select {...register('month')} className={inputClass}>
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Year</label>
                    <input {...register('year')} type="number" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Target Count</label>
                  <input {...register('target_count')} type="number" min="1" placeholder="10" className={inputClass} />
                </div>
              </form>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border mt-auto">
                <Button variant="secondary" type="button" onClick={() => setAddTargetOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit(onSubmitTarget)} loading={isSubmitting}>Set Target</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
