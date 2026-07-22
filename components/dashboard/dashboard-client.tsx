'use client'

import { motion, type Variants } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import StatCard from '@/components/ui/stat-card'
import { Card } from '@/components/ui/card'
import { Glow } from '@/components/ui/glow'
import { formatCurrency, cn } from '@/lib/utils'
import {
  DollarSign, TrendingUp, Wallet, FolderKanban,
  CheckCircle2, Clock, Target, CheckSquare
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { getDashboardData } from '@/app/actions/dashboard'

interface DashboardClientProps {
  userRole?: string
  data: any
}
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 }
  }
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

const CHART_COLORS = {
  primary: '#6366F1',
  cyan: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
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
    }
  })

  const gridColor = resolvedTheme === 'dark' ? '#1E1E2A' : '#E5E7EB'
  const tooltipBgColor = resolvedTheme === 'dark' ? '#171717' : '#FFFFFF'
  const tooltipBorderColor = resolvedTheme === 'dark' ? '#262626' : '#E5E7EB'

  const data = queryData || initialData

  const role = userRole || data?.userRole || 'team_member'
  const allowedModules = data?.allowedModules || []
  
  const hasRevenueAccess = allowedModules.includes('revenue')
  const hasExpensesAccess = allowedModules.includes('expenses')
  const hasProfitabilityAccess = allowedModules.includes('profitability')
  const hasProjectsAccess = allowedModules.includes('projects')
  const hasTargetsAccess = allowedModules.includes('targets')
  const hasAnalyticsAccess = allowedModules.includes('analytics')

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
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-bg-secondary border border-border rounded-xl"></div>)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 h-[280px] bg-bg-secondary border border-border rounded-xl"></div>
          <div className="h-[280px] bg-bg-secondary border border-border rounded-xl"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3].map(i => <div key={i} className="h-[200px] bg-bg-secondary border border-border rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  if (!data || !stats) {
    return (
      <div className="p-8 text-center text-text-secondary bg-bg-secondary rounded-xl border border-border">
        Unable to load dashboard data. Please refresh the page or check your connection.
      </div>
    )
  }

  // Extract projectStatusCard into a variable to reuse
  const projectStatusCard = isProjectsVisible && (
    <Card title="Project Status" className="w-full" padding={false}>
      <div className="p-5">
        {data.projectStatusData.length > 0 ? (
          (() => {
            const totalProjects = data.projectStatusData.reduce((sum: number, entry: any) => sum + entry.value, 0);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
                {/* Chart container */}
                <div className="sm:col-span-3 relative flex items-center justify-center h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={5}
                        cornerRadius={5}
                        dataKey="value"
                      >
                        {data.projectStatusData.map((entry: any, index: number) => (
                          <Cell 
                            key={index} 
                            fill={entry.color} 
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const entry = payload[0].payload;
                            return (
                              <div className="bg-[#171717] border border-[#262626] rounded-lg p-2.5 shadow-2xl text-xs font-semibold z-50 pointer-events-none">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-text-secondary">{entry.name}</span>
                                </div>
                                <span className="text-text font-bold">{payload[0].value} {payload[0].value === 1 ? 'Project' : 'Projects'}</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-3xl font-extrabold text-text tracking-tight">{totalProjects}</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted mt-0.5">Projects</span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="sm:col-span-2 space-y-0">
                  <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Breakdown</p>
                  {data.projectStatusData.map((entry: any, index: number) => {
                    const percentage = totalProjects > 0 ? Math.round((entry.value / totalProjects) * 100) : 0;
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-xs font-medium text-text-secondary truncate">{entry.name}</span>
                        </div>
                        <span className="text-xs font-bold text-text shrink-0 ml-2">{percentage}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">
            No projects yet
          </div>
        )}
      </div>
    </Card>
  )

  
  // Extract pendingTasksCard into a variable to reuse
  const pendingTasksCard = data.pendingTasks && data.pendingTasks.length > 0 && (
    <Card title="Your Pending Tasks" className="w-full" padding={true}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-bg-tertiary border-b border-border text-xs font-semibold text-text-secondary uppercase">
              <th className="px-5 py-3">Task</th>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Deadline</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.pendingTasks.map((task: any) => {
              const PRIORITY_COLORS: Record<string, string> = {
                low: 'text-text-muted bg-bg-tertiary',
                medium: 'text-info bg-info/10',
                high: 'text-warning bg-warning/10',
                urgent: 'text-danger bg-danger/10',
              }
              const STATUS_COLORS: Record<string, string> = {
                todo: 'text-text-secondary bg-bg-tertiary',
                in_progress: 'text-info bg-info/10',
                review: 'text-warning bg-warning/10',
                completed: 'text-success bg-success/10',
              }
              return (
                <tr 
                  key={task.id} 
                  onClick={() => router.push('/my-tasks')}
                  className="border-b border-border last:border-0 hover:bg-bg-tertiary/50 transition-colors cursor-pointer text-xs"
                >
                  <td className="px-5 py-3 font-medium text-text">{task.title}</td>
                  <td className="px-5 py-3 text-text-secondary">{task.projectName || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded font-semibold', PRIORITY_COLORS[task.priority])}>
                      {task.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded font-semibold', STATUS_COLORS[task.status])}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )

  // Extract sharedFilesCard into a variable to reuse
  const sharedFilesCard = data.sharedFiles && data.sharedFiles.length > 0 && (
    <Card title="Files Shared With Me" className="w-full" padding={true}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-bg-tertiary border-b border-border text-xs font-semibold text-text-secondary uppercase">
              <th className="px-5 py-3">File Name</th>
              <th className="px-5 py-3">Context</th>
              <th className="px-5 py-3">Date Shared</th>
            </tr>
          </thead>
          <tbody>
            {data.sharedFiles.map((file: any) => (
              <tr 
                key={file.id} 
                onClick={() => window.open(file.url, '_blank')}
                className="border-b border-border last:border-0 hover:bg-bg-tertiary/50 transition-colors cursor-pointer text-xs"
              >
                <td className="px-5 py-3 font-medium text-text flex items-center gap-2">
                  <span className="truncate">{file.name}</span>
                </td>
                <td className="px-5 py-3 text-text-secondary">
                  {file.project?.name || file.client?.name || 'General'}
                </td>
                <td className="px-5 py-3 text-text-secondary">
                  {new Date(file.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Stat Cards Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {hasRevenueAccess && (
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            change={8.4}
            changeLabel="vs last month"
            icon={DollarSign}
            iconColor="bg-primary/10 text-primary"
            sparkData={revenueSparkData}
            sparkType="bar"
            sparkColor="#6366F1"
            href="/finance/revenue"
          />
        )}
        {hasProfitabilityAccess && (
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
          />
        )}
        {hasExpensesAccess && (
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
          />
        )}
        
        {isProjectsVisible && (
          <>
            <StatCard
              title="Active Projects"
              value={String(stats.activeProjects)}
              icon={FolderKanban}
              iconColor="bg-accent-cyan/10 text-accent-cyan"
              sparkData={data.activeProjectsTrend}
              sparkType="bar"
              sparkColor="#06B6D4"
              href="/projects"
            />
            <StatCard
              title="Completed Projects"
              value={String(stats.completedProjects)}
              icon={CheckCircle2}
              iconColor="bg-success/10 text-success"
              sparkData={data.completedProjectsTrend}
              sparkType="bar"
              sparkColor="#10B981"
              href="/projects?status=completed"
            />
          </>
        )}

        {hasRevenueAccess && (
          <StatCard
            title="Pending Payments"
            value={formatCurrency(stats.pendingPayments)}
            icon={Clock}
            iconColor="bg-warning/10 text-warning"
            sparkData={data.pendingTrend}
            sparkType="area"
            sparkColor="#F59E0B"
            href="/finance/revenue"
          />
        )}

        {data.taskStats && (
          <>
            <StatCard
              title="Assigned Tasks"
              value={String(data.taskStats.total)}
              icon={CheckSquare}
              iconColor="bg-primary/10 text-primary"
              href="/my-tasks"
            />
            <StatCard
              title="Pending Tasks"
              value={String(data.taskStats.pending)}
              icon={Clock}
              iconColor="bg-warning/10 text-warning"
              href="/my-tasks"
            />
            <StatCard
              title="Completed Tasks"
              value={String(data.taskStats.completed)}
              icon={CheckCircle2}
              iconColor="bg-success/10 text-success"
              href="/my-tasks"
            />
          </>
        )}
        {/* Monthly Target card */}
        {isSalesVisible && (
        <div 
          onClick={() => router.push('/targets')}
          className="col-span-2 rounded-xl bg-bg-secondary border border-border p-5 hover:border-border-muted transition-all relative overflow-hidden group cursor-pointer hover:bg-bg-tertiary shadow-sm hover:shadow-md"
        >
          <Glow />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Monthly Target</span>
              <Target size={14} className="text-primary" />
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-2xl font-bold text-text">{stats.monthlyTarget.achieved}</span>
              <span className="text-sm text-text-secondary pb-0.5">/ {stats.monthlyTarget.total} closures</span>
            </div>
            <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${targetPct}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                className="absolute inset-y-0 left-0 bg-primary rounded-full"
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-text-muted">Progress</span>
              <span className="text-xs font-semibold text-primary">{targetPct}%</span>
            </div>
          </div>
        </div>
        )}
      </motion.div>

      {/* Row: Project Status + Pending Tasks (For Non-Admins) or Revenue + Project Status (For Admins) */}
      {!isFinanceVisible ? (
        // Non-Admin: Project Status and Pending Tasks side-by-side
        (isProjectsVisible || (data.pendingTasks && data.pendingTasks.length > 0) || (data.sharedFiles && data.sharedFiles.length > 0)) && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {projectStatusCard}
            <div className="flex flex-col gap-4">
              {pendingTasksCard}
              {sharedFilesCard}
            </div>
          </motion.div>
        )
      ) : (
        // Admin: Revenue Trend and Project Status side-by-side
        (isFinanceVisible || isProjectsVisible) && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Revenue Trend */}
            {isFinanceVisible && (
              <Card title="Revenue Trend" className="xl:col-span-2" padding={false}>
                <div className="px-5 pb-5 pt-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.revenueTrend} barSize={28} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={1} />
                          <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#9191A4', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#9191A4', fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                        cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: 6 }}
                        contentStyle={{ background: tooltipBgColor, border: `1px solid ${tooltipBorderColor}`, borderRadius: 10, fontSize: 12 }}
                        labelStyle={{ color: '#9191A4' }}
                        itemStyle={{ color: CHART_COLORS.primary }}
                      />
                      <Bar dataKey="revenue" fill="url(#revGradient)" radius={[6, 6, 2, 2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {projectStatusCard}
          </motion.div>
        )
      )}

      {/* Charts Row 2: Profit Trend (Admin only) */}
      {isFinanceVisible && (
        <motion.div variants={itemVariants}>
          <Card title="Profit Trend" padding={false}>
            <div className="px-5 pb-5 pt-3">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.profitTrend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#9191A4', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9191A4', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Profit']}
                    cursor={{ stroke: CHART_COLORS.success, strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ background: tooltipBgColor, border: `1px solid ${tooltipBorderColor}`, borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: '#9191A4' }}
                    itemStyle={{ color: CHART_COLORS.success }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke={CHART_COLORS.success}
                    strokeWidth={2.5}
                    fill="url(#profitGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: CHART_COLORS.success, strokeWidth: 2, stroke: '#171717' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      )}
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
