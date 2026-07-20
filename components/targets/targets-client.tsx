'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Target, CheckCircle2, XCircle, Calendar, CalendarCheck, CalendarX, Plus, X, Trash2, TrendingUp } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { SalesTarget, SalesClosure, Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import StatCard from '@/components/ui/stat-card'
import { getServices } from '@/app/actions/services'

import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { upsertTarget as upsertTargetAction, getSalesTargets, getSalesClosures, deleteTarget } from '@/app/actions/targets'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const targetSchema = z.object({
  id: z.string().optional(),
  service_type: z.string().min(1),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number(),
  target_count: z.coerce.number().min(1),
  average_cost: z.coerce.number().min(0).default(0),
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const qc = useQueryClient()
  const supabase = createClient()
  const now = new Date()

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['sales_targets', selectedYear],
    queryFn: async () => {
      const data = await getSalesTargets()
      return data.filter((t: any) => t.year === selectedYear) as unknown as SalesTarget[]
    }
  })

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: getServices
  })

  const { data: closures, isLoading: closuresLoading } = useQuery({
    queryKey: ['sales_closures'],
    queryFn: async () => {
      const data = await getSalesClosures()
      return data as any[]
    }
  })

  const [isDeleting, setIsDeleting] = useState(false)

  const { register, handleSubmit, reset, getValues, formState: { isSubmitting } } = useForm<TargetFormInput, undefined, TargetFormData>({
    resolver: zodResolver(targetSchema),
    defaultValues: { month: now.getMonth() + 1, year: now.getFullYear() },
  })

  const openNewTarget = () => {
    reset({
      id: undefined,
      service_type: '',
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      target_count: '' as any,
      average_cost: '' as any
    })
    setAddTargetOpen(true)
  }

  const editTarget = (t: SalesTarget) => {
    reset({
      id: t.id,
      service_type: t.service_type,
      month: t.month,
      year: t.year,
      target_count: t.target_count,
      average_cost: t.average_cost || 0
    })
    setAddTargetOpen(true)
  }

  const onSubmitTarget = async (data: TargetFormData) => {
    const result = await upsertTargetAction(data)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Target set!')
    qc.invalidateQueries({ queryKey: ['sales_targets'] })
    setAddTargetOpen(false)
    reset()
  }

  const handleDeleteClick = () => {
    if (getValues('id')) setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    const id = getValues('id')
    if (!id) return
    setIsDeleting(true)
    const result = await deleteTarget(id)
    setIsDeleting(false)
    setShowDeleteConfirm(false)
    if (!result.success) { toast.error(result.error); return }
    toast.success('Target deleted!')
    qc.invalidateQueries({ queryKey: ['sales_targets'] })
    setAddTargetOpen(false)
  }

  const closuresStats = (closures ?? []).reduce((acc, c) => {
    if (!acc[c.target_id]) acc[c.target_id] = { count: 0, revenue: 0 }
    acc[c.target_id].count++
    acc[c.target_id].revenue += c.project?.quoted_price || 0
    return acc
  }, {} as Record<string, { count: number, revenue: number }>)

  const targetsList = targets ?? []

  const totalSetTarget = targetsList.reduce((acc, t) => acc + t.target_count, 0)
  const monthlySetTarget = targetsList.filter(t => t.month === selectedMonth).reduce((acc, t) => acc + t.target_count, 0)

  const totalTargetAchieved = targetsList.reduce((acc, t) => acc + (closuresStats[t.id]?.count || 0), 0)
  const monthlyTargetAchieved = targetsList.filter(t => t.month === selectedMonth).reduce((acc, t) => acc + (closuresStats[t.id]?.count || 0), 0)

  const totalMissedTarget = Math.max(0, totalSetTarget - totalTargetAchieved)
  const monthlyMissedTarget = Math.max(0, monthlySetTarget - monthlyTargetAchieved)

  // Revenue calculations
  const totalTargetRevenue = targetsList.reduce((acc, t) => acc + (t.target_count * (t.average_cost || 0)), 0)
  const monthlyTargetRevenue = targetsList.filter(t => t.month === selectedMonth).reduce((acc, t) => acc + (t.target_count * (t.average_cost || 0)), 0)

  const totalAchievedRevenue = targetsList.reduce((acc, t) => acc + (closuresStats[t.id]?.revenue || 0), 0)
  const monthlyAchievedRevenue = targetsList.filter(t => t.month === selectedMonth).reduce((acc, t) => acc + (closuresStats[t.id]?.revenue || 0), 0)

  const displayedTargets = selectedMonth === 0 ? targetsList : targetsList.filter(t => t.month === selectedMonth)

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Sales Targets - {selectedYear}</h2>
          <p className="text-sm text-text-secondary mt-0.5">Monthly service-wise targets and achievements</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs font-medium text-text-secondary focus:outline-none">
            <option value={0}>All Months</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs font-medium text-text-secondary focus:outline-none">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={openNewTarget}><Plus size={15} /> Set Target</Button>
        </div>
      </div>

      {/* Analytics Stats */}
      {/* Analytics Stats */}
      {targetsLoading || closuresLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-bg-secondary border border-border rounded-xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Goal / Targets */}
          <div className="bg-bg-secondary border border-border rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-text-secondary">Sales Goal (Targets)</span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Target size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-text">₹{totalTargetRevenue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{totalSetTarget} Target Deals (Total)</p>
              </div>
            </div>
            {selectedMonth > 0 && (
              <div className="border-t border-border mt-3 pt-2.5 flex justify-between text-[11px] text-text-secondary">
                <div>
                  <p className="text-text-muted">Monthly Target</p>
                  <p className="font-semibold text-text mt-0.5">₹{monthlyTargetRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted">Monthly Deals</p>
                  <p className="font-semibold text-text mt-0.5">{monthlySetTarget} Deals</p>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Revenue Achieved */}
          <div className="bg-bg-secondary border border-border rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-text-secondary">Revenue Achieved</span>
                <div className="w-7 h-7 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <CheckCircle2 size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">₹{totalAchievedRevenue.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {totalTargetAchieved} Deals closed (Total)
                </p>
              </div>
            </div>
            {selectedMonth > 0 && (
              <div className="border-t border-border mt-3 pt-2.5 flex justify-between text-[11px] text-text-secondary">
                <div>
                  <p className="text-text-muted">Monthly Achieved</p>
                  <p className="font-semibold text-success mt-0.5">₹{monthlyAchievedRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted">Monthly Deals</p>
                  <p className="font-semibold text-text mt-0.5">{monthlyTargetAchieved} Deals</p>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Missed / Remaining */}
          <div className="bg-bg-secondary border border-border rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-text-secondary">Missed / Remaining</span>
                <div className="w-7 h-7 rounded-lg bg-danger/10 text-danger flex items-center justify-center">
                  <XCircle size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-danger">₹{Math.max(0, totalTargetRevenue - totalAchievedRevenue).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{totalMissedTarget} Deals missed/remaining</p>
              </div>
            </div>
            {selectedMonth > 0 && (
              <div className="border-t border-border mt-3 pt-2.5 flex justify-between text-[11px] text-text-secondary">
                <div>
                  <p className="text-text-muted">Monthly Missed</p>
                  <p className="font-semibold text-danger mt-0.5">₹{Math.max(0, monthlyTargetRevenue - monthlyAchievedRevenue).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted">Monthly Deals</p>
                  <p className="font-semibold text-text mt-0.5">{monthlyMissedTarget} Deals</p>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Sales Performance (Win Rate) */}
          <div className="bg-bg-secondary border border-border rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-text-secondary">Sales Performance</span>
                <div className="w-7 h-7 rounded-lg bg-accent-cyan/10 text-accent-cyan flex items-center justify-center">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-text">{totalSetTarget > 0 ? Math.round((totalTargetAchieved / totalSetTarget) * 100) : 0}%</p>
                <p className="text-[11px] text-text-muted mt-0.5">{totalTargetAchieved} / {totalSetTarget} Deals Closed (Total)</p>
              </div>
            </div>
            {selectedMonth > 0 && (
              <div className="border-t border-border mt-3 pt-2.5 flex justify-between text-[11px] text-text-secondary">
                <div>
                  <p className="text-text-muted">Monthly Rate</p>
                  <p className="font-semibold text-text mt-0.5">
                    {monthlySetTarget > 0 ? Math.round((monthlyTargetAchieved / monthlySetTarget) * 100) : 0}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted">Monthly Closed</p>
                  <p className="font-semibold text-text mt-0.5">{monthlyTargetAchieved} / {monthlySetTarget} Deals</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Targets grid */}
      {targetsLoading || closuresLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-bg-secondary border border-border rounded-xl"></div>)}
        </div>
      ) : displayedTargets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No targets set for this period</p>
          <p className="text-sm text-text-muted mt-1">Set monthly targets to track your sales team performance</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedTargets.map(t => {
            const stats = closuresStats[t.id] || { count: 0, revenue: 0 }
            const achieved = stats.count
            const remaining = Math.max(0, t.target_count - achieved)
            const pct = t.target_count > 0 ? Math.min(Math.round((achieved / t.target_count) * 100), 100) : 0
            const totalRevenueTarget = t.target_count * (t.average_cost || 0)
            const achievedRevenue = stats.revenue
            
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => editTarget(t)}
                className="bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-muted transition-all cursor-pointer hover:bg-bg-tertiary">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-text text-sm">{t.service_type}</p>
                    <p className="text-xs text-text-muted">{MONTHS[t.month - 1]} {t.year}</p>
                  </div>
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', pct >= 100 ? 'bg-success-muted text-success' : pct >= 60 ? 'bg-warning-muted text-warning' : 'bg-danger-muted text-danger')}>
                    {pct}%
                  </span>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-text">{achieved}</span>
                    <span className="text-text-muted text-sm pb-1">/ {t.target_count}</span>
                  </div>
                  {t.average_cost ? (
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Target Rev.</p>
                      <p className="text-sm font-semibold text-text">₹{totalRevenueTarget.toLocaleString('en-IN')}</p>
                    </div>
                  ) : null}
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
                  <span>Achieved: <span className="text-text font-medium">{achieved}</span> <span className="text-text font-medium">(₹{achievedRevenue.toLocaleString('en-IN')})</span></span>
                  <span>Remaining: <span className="text-text font-medium">{remaining}</span> <span className="text-text font-medium">(₹{Math.max(0, totalRevenueTarget - achievedRevenue).toLocaleString('en-IN')})</span></span>
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
                    <option value="">Select a service...</option>
                    {services.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Target Count</label>
                    <input {...register('target_count')} type="number" min="1" placeholder="10" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Average Cost (₹)</label>
                    <input {...register('average_cost')} type="number" min="0" placeholder="25000" className={inputClass} />
                  </div>
                </div>
              </form>
              <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-auto">
                <div>
                  {getValues('id') && (
                    <Button variant="danger" type="button" onClick={handleDeleteClick} className="bg-danger/10 text-danger hover:bg-danger/20">
                      <Trash2 size={15} className="mr-1.5" /> Delete
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" type="button" onClick={() => setAddTargetOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmit(onSubmitTarget)} loading={isSubmitting}>Set Target</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Sales Target"
        description="Are you sure you want to delete this sales target? This action cannot be undone, but existing closures will not be deleted."
        confirmText="Delete Target"
        loading={isDeleting}
      />
    </div>
  )
}
