'use client'

import { motion, type Variants } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import StatCard from '@/components/ui/stat-card'
import { Card } from '@/components/ui/card'
import { Glow } from '@/components/ui/glow'
import { formatCurrency, cn } from '@/lib/utils'
import {
  DollarSign, TrendingUp, Wallet, FolderKanban,
  CheckCircle2, Clock, Target, CheckSquare, Plus,
  Users, FileText, Check, AlertTriangle, ArrowRight,
  Flame, Layers, CalendarDays, FileIcon
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboardData } from '@/app/actions/dashboard'
import { CalendarWidget } from './calendar-widget'
import TaskModal from '@/components/tasks/task-modal'
import ProjectModal from '@/components/projects/project-modal'
import ClientModal from '@/components/clients/client-modal'
import InvoiceModal from '@/components/finance/invoice-modal'
import { getProjects } from '@/app/actions/projects'
import { getTeamMembers } from '@/app/actions/team'
import { getClients } from '@/app/actions/clients'
import type { Project, Profile, Client } from '@/types'

interface DashboardClientProps {
  userRole?: string
  data: any
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
}

const CHART_COLORS = {
  primary: '#6366F1',
  cyan: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  surface: '#09090b',
  border: 'rgba(255, 255, 255, 0.05)',
  textMuted: '#A1A1AA'
}

function DashboardContent({ data: initialData, userRole }: DashboardClientProps) {
  const { resolvedTheme } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)

  // Any modal being open triggers data fetching
  const anyModalOpen = taskModalOpen || projectModalOpen || clientModalOpen || invoiceModalOpen

  useEffect(() => {
    if (searchParams?.get('login') === 'success') {
      router.replace('/')
    }
  }, [searchParams, router])

  const { data: projectsData = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await getProjects()
      return data as unknown as Pick<Project, 'id' | 'name' | 'project_code' | 'client_id' | 'quoted_price' | 'expected_completion' | 'invoices'>[]
    },
    enabled: anyModalOpen,
  })

  const { data: profilesData = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const data = await getTeamMembers()
      return data as unknown as Pick<Profile, 'id' | 'full_name' | 'role'>[]
    },
    enabled: anyModalOpen,
  })

  const { data: clientsData = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = await getClients()
      return data as unknown as Pick<Client, 'id' | 'name' | 'company_name'>[]
    },
    enabled: anyModalOpen,
  })

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const res = await getDashboardData()
      return res
    },
    initialData: initialData || undefined,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })

  const gridColor = resolvedTheme === 'dark' ? 'rgba(255,255,255,0.03)' : '#E5E7EB'
  const tooltipBgColor = resolvedTheme === 'dark' ? '#09090b' : '#FFFFFF'
  const tooltipBorderColor = resolvedTheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#E5E7EB'

  const data = queryData || initialData
  const role = userRole || data?.userRole || 'team_member'
  const allowedModules = data?.allowedModules || []
  
  const hasRevenueAccess = allowedModules.includes('revenue')
  const hasExpensesAccess = allowedModules.includes('expenses')
  const hasProfitabilityAccess = allowedModules.includes('profitability')
  const hasProjectsAccess = allowedModules.includes('projects')
  const hasTargetsAccess = allowedModules.includes('targets')

  const isFinanceVisible = hasRevenueAccess || hasExpensesAccess || hasProfitabilityAccess
  const isSalesVisible = hasTargetsAccess
  const isProjectsVisible = hasProjectsAccess

  const stats = data?.stats
  const targetPct = stats?.monthlyTarget?.total > 0
    ? Math.round((stats.monthlyTarget.achieved / stats.monthlyTarget.total) * 100)
    : 0

  const revenueSparkData = data?.revenueTrend?.map((r: any) => r.revenue) || []
  const profitSparkData = data?.profitTrend?.map((r: any) => r.profit) || []

  const getChange = (arr: number[]) => {
    if (!arr || arr.length < 2) return 0
    const current = arr[arr.length - 1] || 0
    const previous = arr[arr.length - 2] || 0
    if (previous === 0) return current > 0 ? 100 : 0
    return Number((((current - previous) / previous) * 100).toFixed(1))
  }

  const revenueChange = getChange(revenueSparkData)
  const profitChange = getChange(profitSparkData)
  const expensesChange = getChange(data?.expensesTrend || [])
  const pendingChange = getChange(data?.pendingTrend || [])

  if (isLoading) {
    return <div className="p-8 text-text-muted text-sm">Loading dashboard...</div>
  }

  if (!data || !stats) {
    return <div className="p-8 text-text-muted text-sm">Unable to load dashboard data.</div>
  }

  const PRIORITY_COLORS: Record<string, string> = {
    low: 'text-text-muted bg-white/5',
    medium: 'text-info bg-info/10',
    high: 'text-warning bg-warning/10',
    urgent: 'text-danger bg-danger/10',
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-[1600px]">
      
      {/* Grid: 9 columns main, 3 columns sidebar (narrower sidebar) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Main Column */}
        <div className="xl:col-span-9 flex flex-col gap-6">
          
          {/* Quick Actions Bar — role-gated */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-5 md:gap-7 -mb-1">
            {/* Create Project — needs projects module */}
            {isProjectsVisible && (
              <div onClick={() => setProjectModalOpen(true)} className="flex items-center gap-2.5 cursor-pointer group">
                <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-primary transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-primary/50 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.15)]">
                  <Plus size={16} />
                </div>
                <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Create Project</span>
              </div>
            )}
            {/* Add Task — visible to all, opens task modal */}
            <div onClick={() => setTaskModalOpen(true)} className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-success transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-success/50 group-hover:shadow-[0_0_15px_rgba(var(--success),0.15)]">
                <CheckSquare size={16} />
              </div>
              <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Add Task</span>
            </div>
            {/* Add Client — admin only */}
            {role === 'admin' && (
              <div onClick={() => setClientModalOpen(true)} className="flex items-center gap-2.5 cursor-pointer group">
                <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-info transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-info/50 group-hover:shadow-[0_0_15px_rgba(var(--info),0.15)]">
                  <Users size={16} />
                </div>
                <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Add Client</span>
              </div>
            )}
            {/* Create Invoice — needs revenue module */}
            {hasRevenueAccess && (
              <div onClick={() => setInvoiceModalOpen(true)} className="flex items-center gap-2.5 cursor-pointer group">
                <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-warning transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-warning/50 group-hover:shadow-[0_0_15px_rgba(var(--warning),0.15)]">
                  <FileText size={16} />
                </div>
                <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Create Invoice</span>
              </div>
            )}
            {/* Manage Files — visible to all */}
            <div onClick={() => router.push('/files')} className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-accent-cyan transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-accent-cyan/50 group-hover:shadow-[0_0_15px_rgba(var(--accent-cyan),0.15)]">
                <FolderKanban size={16} />
              </div>
              <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Manage Files</span>
            </div>
          </motion.div>

          {/* Dense Stats Grid using 6 columns to perfectly map 2:1 and 1:1 ratios */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            
            {/* The Target card (2/3 of row 1) */}
            {isSalesVisible && (
              <div 
                onClick={() => router.push('/targets')}
                className="col-span-2 lg:col-span-4 rounded-xl bg-bg-secondary border border-border p-5 hover:border-border-muted transition-all relative overflow-hidden group cursor-pointer hover:bg-bg-tertiary shadow-sm hover:shadow-md"
              >
                <Glow />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Monthly Target</span>
                    <Target size={14} className="text-orange-500" />
                  </div>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-2xl font-bold text-text">{stats.monthlyTarget.achieved}</span>
                    <span className="text-sm text-text-secondary pb-0.5">/ {stats.monthlyTarget.total} closures</span>
                  </div>
                  <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${targetPct}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                      className="absolute inset-y-0 left-0 bg-orange-500 rounded-full"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-text-muted">Progress</span>
                    <span className="text-xs font-semibold text-orange-500">{targetPct}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Revenue (1/3 of row 1) */}
            {hasRevenueAccess && (
              <div className="col-span-2 lg:col-span-2">
                <StatCard
                  title="Total Revenue"
                  value={formatCurrency(stats.totalRevenue)}
                  change={revenueChange}
                  changeLabel="vs last month"
                  icon={DollarSign}
                  iconColor="bg-primary/10 text-primary"
                  sparkData={revenueSparkData}
                  sparkType="bar"
                  href="/finance/revenue"
                  className="h-full"
                  variant="orange"
                />
              </div>
            )}
            {/* Net Profit (1/3 of row 2) */}
            {hasProfitabilityAccess && (
              <div className="col-span-1 lg:col-span-2">
                <StatCard
                  title="Net Profit"
                  value={formatCurrency(stats.totalProfit)}
                  change={profitChange}
                  changeLabel="vs last month"
                  icon={TrendingUp}
                  iconColor="bg-success/10 text-success"
                  sparkData={profitSparkData}
                  sparkType="area"
                  sparkColor="#10B981"
                  href="/profitability"
                  className="h-full"
                />
              </div>
            )}
            {/* Total Expenses (1/3 of row 2) */}
            {hasExpensesAccess && (
              <div className="col-span-1 lg:col-span-2">
                <StatCard
                  title="Total Expenses"
                  value={formatCurrency(stats.totalExpenses)}
                  change={expensesChange}
                  changeLabel="vs last month"
                  icon={Wallet}
                  iconColor="bg-danger/10 text-danger"
                  sparkData={data.expensesTrend}
                  sparkType="area"
                  sparkColor="#EF4444"
                  href="/finance/expenses"
                  className="h-full"
                />
              </div>
            )}
            
            {/* Pending Payments (1/3 of row 2) */}
            {hasRevenueAccess && (
              <div className="col-span-1 lg:col-span-2">
                <StatCard
                  title="Pending Payments"
                  value={formatCurrency(stats.pendingPayments)}
                  change={pendingChange}
                  changeLabel="vs last month"
                  icon={Clock}
                  iconColor="bg-warning/10 text-warning"
                  sparkData={data.pendingTrend}
                  sparkType="area"
                  sparkColor="#F59E0B"
                  href="/finance/revenue"
                  className="h-full"
                />
              </div>
            )}

            {data.taskStats && (
              <>
                <div className="col-span-2 lg:col-span-2">
                  <StatCard title="Assigned Tasks" value={String(data.taskStats.total)} icon={CheckSquare} iconColor="bg-primary/10 text-primary" href="/my-tasks" className="h-full" />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <StatCard title="Pending Tasks" value={String(data.taskStats.pending)} icon={Clock} iconColor="bg-warning/10 text-warning" href="/my-tasks" className="h-full" />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <StatCard title="Completed Tasks" value={String(data.taskStats.completed)} icon={CheckCircle2} iconColor="bg-success/10 text-success" href="/my-tasks" className="h-full" />
                </div>
              </>
            )}
          </motion.div>

          {/* ─── Personal Workspace — data-driven, works for ANY role with task access ─── */}
          {data.taskStats && (
            <>
              {/* Row 1: Productivity Overview + Weekly Activity */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-5 gap-4">

                {/* Productivity Ring Card — compact layout */}
                <div className="md:col-span-2 rounded-2xl bg-bg-secondary border border-border p-5 relative overflow-hidden flex flex-col">
                  <Glow />
                  <div className="relative z-10 flex flex-col h-full">

                    {/* Header with Title and Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">My Productivity</span>
                        
                        {/* Urgency Badges moved to header */}
                        {(data.overdueCount ?? 0) > 0 ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/10 border border-red-500/30">
                            <AlertTriangle size={8} className="text-danger" />
                            <span className="text-[9px] font-semibold text-danger">{data.overdueCount} overdue</span>
                          </div>
                        ) : (data.dueTodayCount ?? 0) > 0 ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 border border-orange-500/30">
                            <Flame size={8} className="text-warning" />
                            <span className="text-[9px] font-semibold text-warning">{data.dueTodayCount} today</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 border border-green-500/30">
                            <CheckCircle2 size={8} className="text-success" />
                            <span className="text-[9px] font-semibold text-success">On track</span>
                          </div>
                        )}
                      </div>
                      <button onClick={() => router.push('/my-tasks')} className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors">
                        View All <ArrowRight size={10} />
                      </button>
                    </div>

                    {(() => {
                      const total = data.taskStats.total
                      const done = data.taskStats.completed
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0
                      const r = 50; const circ = 2 * Math.PI * r
                      const ringColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#6366F1' : '#F59E0B'
                      return (
                        <div className="flex-1 flex flex-col justify-between gap-3">
                          
                          {/* Left-Right Layout: Ring & Stats */}
                          <div className="flex flex-row items-center gap-4 px-1">
                            {/* Ring on the left */}
                            <div className="relative shrink-0">
                              <svg width="110" height="110" className="-rotate-90">
                                <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                <motion.circle
                                  cx="55" cy="55" r={r} fill="none"
                                  stroke={ringColor}
                                  strokeWidth="10" strokeLinecap="round"
                                  strokeDasharray={`${circ}`}
                                  initial={{ strokeDashoffset: circ }}
                                  animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
                                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center mt-0.5">
                                <span className="text-2xl font-bold text-text leading-none">{pct}%</span>
                                <span className="text-[9px] font-medium text-text-muted uppercase tracking-widest mt-1">Done</span>
                              </div>
                            </div>

                            {/* Stats stacked vertically on the right */}
                            <div className="flex-1 flex flex-col gap-1.5">
                              {[
                                { label: 'Total Tasks', value: total, color: 'text-text' },
                                { label: 'Completed', value: done, color: 'text-success' },
                                { label: 'Pending', value: data.taskStats.pending, color: 'text-warning' },
                              ].map(s => (
                                <div key={s.label} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-bg/50 border border-border">
                                  <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">{s.label}</span>
                                  <span className={cn('text-sm font-bold leading-none', s.color)}>{s.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Status breakdown */}
                          {data.tasksByStatus && (
                            <div className="flex flex-col gap-2.5 mt-2">
                              <span className="text-[9px] font-semibold text-text-muted uppercase tracking-widest mb-0.5">Breakdown</span>
                              {[
                                { key: 'todo', label: 'To Do', value: data.tasksByStatus.todo, color: 'bg-text-muted/40' },
                                { key: 'in_progress', label: 'In Progress', value: data.tasksByStatus.in_progress, color: 'bg-info' },
                                { key: 'review', label: 'Review', value: data.tasksByStatus.review, color: 'bg-warning' },
                                { key: 'completed', label: 'Done', value: data.tasksByStatus.completed, color: 'bg-success' },
                              ].map(s => {
                                const barPct = total > 0 ? (s.value / total) * 100 : 0
                                return (
                                  <div key={s.key} className="flex items-center gap-3">
                                    <span className="text-[9px] text-text-muted w-16 shrink-0">{s.label}</span>
                                    <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
                                      <motion.div
                                        className={cn('h-full rounded-full', s.color)}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${barPct}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-semibold text-text-secondary w-4 text-right shrink-0">{s.value}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Weekly Activity Chart + Status Pipeline */}
                <div className="md:col-span-3 flex flex-col gap-4">

                  {/* Weekly Activity */}
                  {data.weeklyActivity && (
                    <div className="rounded-2xl bg-bg-secondary border border-border px-5 pt-5 pb-2 relative overflow-hidden">
                      <Glow />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Weekly Activity</span>
                          <span className="text-[10px] text-text-muted">Tasks completed / day</span>
                        </div>
                        <div className="h-[90px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.weeklyActivity} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={14}>
                              <XAxis dataKey="day" tick={{ fill: CHART_COLORS.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} />
                              <Tooltip
                                contentStyle={{ background: tooltipBgColor, border: `1px solid ${tooltipBorderColor}`, borderRadius: 8, fontSize: 11 }}
                                itemStyle={{ color: CHART_COLORS.success }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                              />
                              <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task Status Pipeline */}
                  {data.tasksByStatus && (
                    <div className="rounded-2xl bg-bg-secondary border border-border p-5 relative overflow-hidden">
                      <Glow />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5"><Layers size={12} />Status Pipeline</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { key: 'todo', label: 'To Do', color: 'bg-text-muted/30', textColor: 'text-text-muted', value: data.tasksByStatus.todo },
                            { key: 'in_progress', label: 'In Progress', color: 'bg-info/20', textColor: 'text-info', value: data.tasksByStatus.in_progress },
                            { key: 'review', label: 'Review', color: 'bg-warning/20', textColor: 'text-warning', value: data.tasksByStatus.review },
                            { key: 'completed', label: 'Done', color: 'bg-success/20', textColor: 'text-success', value: data.tasksByStatus.completed },
                          ].map(s => (
                            <div key={s.key} onClick={() => router.push('/my-tasks')} className="cursor-pointer flex flex-col items-center gap-1.5 p-3 rounded-xl bg-bg hover:bg-bg-tertiary border border-border hover:border-border-muted transition-all group">
                              <span className={cn('text-xl font-bold', s.textColor)}>{s.value}</span>
                              <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider text-center leading-tight">{s.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Row 2: Upcoming Deadlines + Recent Files */}
              <motion.div variants={itemVariants} className={cn('grid gap-4', (data.recentFiles?.length > 0) ? 'grid-cols-1 md:grid-cols-5' : 'grid-cols-1')}>

                {/* Upcoming Deadlines Timeline */}
                {data.upcomingTasks && data.upcomingTasks.length > 0 && (
                  <div className={cn('rounded-2xl bg-bg-secondary border border-border p-5 relative overflow-hidden', (data.recentFiles?.length > 0) ? 'md:col-span-3' : '')}>
                    <Glow />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                          <CalendarDays size={12} /> Upcoming Deadlines
                        </h3>
                        <button onClick={() => router.push('/my-tasks')} className="text-[10px] uppercase tracking-widest font-semibold text-text-muted hover:text-text transition-colors">View All</button>
                      </div>
                      <div className="space-y-1">
                        {data.upcomingTasks.map((task: any) => {
                          const now = new Date()
                          const dl = task.deadline ? new Date(task.deadline) : null
                          const todayMid = new Date(); todayMid.setHours(0,0,0,0)
                          const isOverdueDl = dl && dl < todayMid
                          const isTodayDl = dl && !isOverdueDl && dl.toDateString() === new Date().toDateString()
                          const isTomorrow = dl && !isOverdueDl && !isTodayDl && (dl.getTime() - now.getTime()) < 2 * 86400000

                          const urgencyLeft = isOverdueDl ? 'bg-danger' : isTodayDl ? 'bg-warning' : isTomorrow ? 'bg-orange-400' : 'bg-border'
                          const deadlineText = !dl ? 'No deadline'
                            : isOverdueDl ? `Overdue · ${dl.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                            : isTodayDl ? 'Due today'
                            : isTomorrow ? 'Due tomorrow'
                            : `Due ${dl.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          const deadlineColor = isOverdueDl ? 'text-danger' : isTodayDl ? 'text-warning' : isTomorrow ? 'text-orange-400' : 'text-text-muted'

                          return (
                            <div
                              key={task.id}
                              onClick={() => router.push('/my-tasks')}
                              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-tertiary transition-all cursor-pointer group border border-transparent hover:border-border"
                            >
                              <div className={cn('w-0.5 h-8 rounded-full shrink-0', urgencyLeft)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {task.projectName && <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium truncate max-w-[80px]">{task.projectName}</span>}
                                  <span className={cn('text-[9px] font-semibold', deadlineColor)}>{deadlineText}</span>
                                </div>
                              </div>
                              <span className={cn('text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0', PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Shared Files — with image previews */}
                {data.recentFiles && data.recentFiles.length > 0 && (
                  <div className="md:col-span-2 rounded-2xl bg-bg-secondary border border-border p-5 relative overflow-hidden">
                    <Glow />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                          <FileIcon size={12} /> Shared Files
                        </h3>
                        <button onClick={() => router.push('/files')} className="text-[10px] uppercase tracking-widest font-semibold text-text-muted hover:text-text transition-colors">View All</button>
                      </div>
                      <div className="space-y-1.5">
                        {data.recentFiles.map((file: any) => {
                          const mime: string = file.mimeType || ''
                          const name: string = file.name || 'Unnamed File'
                          const ext = name.split('.').pop()?.toLowerCase() || ''
                          const isImg = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
                          const isPdf = mime === 'application/pdf' || ext === 'pdf'
                          const isVideo = mime.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)
                          const sizeStr = file.size ? (file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`) : null

                          // Truncate long names: keep base name + extension
                          const nameParts = name.lastIndexOf('.') > 0 ? [name.slice(0, name.lastIndexOf('.')), name.slice(name.lastIndexOf('.'))] : [name, '']
                          const displayName = nameParts[0].length > 22 ? nameParts[0].slice(0, 22) + '…' + nameParts[1] : name

                          return (
                            <a key={file.id} href={file.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-3 p-2 rounded-xl hover:bg-bg-tertiary transition-all group border border-transparent hover:border-border"
                            >
                              {/* Thumbnail / Icon */}
                              <div className="w-10 h-10 rounded-lg bg-bg border border-border flex items-center justify-center shrink-0 overflow-hidden relative">
                                {isImg ? (
                                  <img
                                    src={file.url}
                                    alt={name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement)?.removeAttribute('style') }}
                                />
                              ) : null}
                              {/* Fallback badge (hidden if image loads) */}
                              <div className={cn(
                                'absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase',
                                isImg ? 'hidden' : '',
                                isPdf ? 'bg-danger/10 text-danger' : isVideo ? 'bg-primary/10 text-primary' : 'bg-bg-tertiary text-text-muted'
                              )}>
                                {isPdf ? 'PDF' : isVideo ? 'VID' : ext ? ext.toUpperCase().slice(0, 4) : <FileIcon size={14} />}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-text" title={name}>{displayName}</p>
                              <p className="text-[9px] text-text-muted mt-0.5 flex items-center gap-1.5">
                                {file.createdAt && <span>{new Date(file.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                                {sizeStr && <><span className="opacity-40">·</span><span>{sizeStr}</span></>}
                              </p>
                            </div>
                            <ArrowRight size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

                {/* Empty state when no upcoming tasks */}
                {(!data.upcomingTasks || data.upcomingTasks.length === 0) && (!data.recentFiles || data.recentFiles.length === 0) && (
                  <div className="col-span-full rounded-2xl bg-bg-secondary border border-border p-10 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-success" />
                    </div>
                    <p className="text-sm font-semibold text-text">You&apos;re all caught up!</p>
                    <p className="text-xs text-text-muted max-w-xs">No pending tasks or deadlines. Click <strong>Add Task</strong> above to get started.</p>
                  </div>
                )}
              </motion.div>
            </>
          )}

          {/* Revenue Trend Chart */}
          {isFinanceVisible && (
            <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6">
              <div className="rounded-2xl bg-bg-secondary border border-border p-6">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-medium text-text">Revenue Trend</h3>
                  <button onClick={() => router.push('/analytics')} className="text-xs text-text-muted hover:text-text transition-colors">Details</button>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenueTrend} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15}/>
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: CHART_COLORS.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: CHART_COLORS.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip
                        contentStyle={{ background: tooltipBgColor, border: `1px solid ${tooltipBorderColor}`, borderRadius: 12, fontSize: 12, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: CHART_COLORS.primary }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

        </div>

        {/* Sidebar Column (30%) */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <motion.div variants={itemVariants}>
            <CalendarWidget events={data.unifiedEvents || []} />
          </motion.div>

          {/* Project Status Donut Chart moved to the 30% sidebar */}
          {isProjectsVisible && data.projectStatusData && data.projectStatusData.length > 0 && (
            <motion.div variants={itemVariants} className="rounded-2xl bg-bg-secondary border border-border p-5 flex-col shadow-sm relative z-10 w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">Project Status</h3>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 w-full gap-4 mt-2">
                {/* Top: Pie Chart */}
                <div className="relative w-full h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={4}
                      >
                        {data.projectStatusData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-text leading-none">
                      {data.projectStatusData.reduce((sum: number, e: any) => sum + e.value, 0)}
                    </span>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mt-1">Projects</span>
                  </div>
                </div>

                {/* Bottom: Breakdown */}
                <div className="w-full flex flex-col justify-center mt-2">
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-4">Breakdown</div>
                  <div className="space-y-3.5">
                    {data.projectStatusData.map((entry: any, index: number) => {
                      const totalProjects = data.projectStatusData.reduce((sum: number, e: any) => sum + e.value, 0)
                      const percentage = totalProjects > 0 ? Math.round((entry.value / totalProjects) * 100) : 0
                      return (
                        <div key={index} className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="font-medium text-text-muted">{entry.name}</span>
                          </div>
                          <span className="text-text font-semibold">{percentage}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={null}
        projects={projectsData}
        profiles={profilesData}
        userRole={userRole}
      />
      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        project={null}
        clients={clientsData}
        profiles={profilesData}
        userRole={userRole}
      />
      <ClientModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        client={null}
      />
      <InvoiceModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoice={null}
        projects={projectsData as any}
        clients={clientsData}
      />
    </motion.div>
  )
}

export default function DashboardClient(props: DashboardClientProps) {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8">Loading dashboard...</div>}>
      <DashboardContent {...props} />
    </Suspense>
  )
}
