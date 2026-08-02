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
  Users, FileText, Check
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboardData } from '@/app/actions/dashboard'
import { CalendarWidget } from './calendar-widget'

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

  useEffect(() => {
    if (searchParams?.get('login') === 'success') {
      router.replace('/')
    }
  }, [searchParams, router])

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const res = await getDashboardData()
      return res
    },
    initialData: initialData || undefined,
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
          
          {/* Quick Actions Bar */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-5 md:gap-7 py-2">
            <div onClick={() => router.push('/projects/new')} className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-primary transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-primary/50 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.15)]">
                <Plus size={16} />
              </div>
              <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Create Project</span>
            </div>
            <div onClick={() => router.push('/my-tasks')} className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-success transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-success/50 group-hover:shadow-[0_0_15px_rgba(var(--success),0.15)]">
                <CheckSquare size={16} />
              </div>
              <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Add Task</span>
            </div>
            <div onClick={() => router.push('/clients')} className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-info transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-info/50 group-hover:shadow-[0_0_15px_rgba(var(--info),0.15)]">
                <Users size={16} />
              </div>
              <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Add Client</span>
            </div>
            <div onClick={() => router.push('/finance/revenue')} className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-warning transition-all duration-300 group-hover:bg-bg-tertiary group-hover:border-warning/50 group-hover:shadow-[0_0_15px_rgba(var(--warning),0.15)]">
                <FileText size={16} />
              </div>
              <span className="font-medium text-[13px] text-text-muted group-hover:text-text transition-colors">Create Invoice</span>
            </div>
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
                  change={8.4}
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
                  change={stats.totalProfit > 0 ? 5.2 : -5.2}
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
                  change={-2.1}
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
                <StatCard title="Assigned Tasks" value={String(data.taskStats.total)} icon={CheckSquare} iconColor="bg-primary/10 text-primary" href="/my-tasks" />
                <StatCard title="Pending Tasks" value={String(data.taskStats.pending)} icon={Clock} iconColor="bg-warning/10 text-warning" href="/my-tasks" />
                <StatCard title="Completed Tasks" value={String(data.taskStats.completed)} icon={CheckCircle2} iconColor="bg-success/10 text-success" href="/my-tasks" />
              </>
            )}
          </motion.div>

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



          {/* Actionable Tasks List */}
          {data.pendingTasks && data.pendingTasks.length > 0 && (
            <motion.div variants={itemVariants}>
              <div className="rounded-2xl bg-bg-secondary border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-text flex items-center gap-2">
                    <CheckSquare size={14} className="text-text-muted" /> Tasks
                  </h3>
                  <button onClick={() => router.push('/my-tasks')} className="text-[10px] uppercase tracking-widest font-semibold text-text-muted hover:text-text transition-colors">View All</button>
                </div>
                <div className="space-y-1">
                  {data.pendingTasks.slice(0, 5).map((task: any) => (
                    <div 
                      key={task.id} 
                      onClick={() => router.push('/my-tasks')}
                      className="group flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-bg-tertiary transition-colors cursor-pointer border border-transparent hover:border-border"
                    >
                      <div className="mt-0.5 w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center text-transparent group-hover:border-primary transition-colors shrink-0">
                        <Check size={8} className="group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider', PRIORITY_COLORS[task.priority])}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
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
