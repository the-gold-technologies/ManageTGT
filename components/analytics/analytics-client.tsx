'use client'

import { motion, type Variants } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { Card } from '@/components/ui/card'
import StatCard from '@/components/ui/stat-card'
import { formatCurrency, calculateMargin } from '@/lib/utils'
import { DollarSign, TrendingUp, FolderKanban, CheckCircle2 } from 'lucide-react'

const COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#EC4899']

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

interface AnalyticsClientProps {
  monthlyData: Array<{ month: string; revenue: number; expenses: number; profit: number }>
  serviceData: Array<{ name: string; value: number }>
  projects: Array<{ status: string; service_type: string; quoted_price: number; created_at: string }>
  tasks: Array<{ status: string; created_at: string; completion_date: string | null; assigned_to: string | null }>
}

export default function AnalyticsClient({ monthlyData, serviceData, projects, tasks }: AnalyticsClientProps) {
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0)
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const margin = calculateMargin(totalRevenue, totalProfit)

  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const pendingTasks = tasks.filter(t => t.status !== 'completed').length

  const projectStatusData = [
    { name: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#10B981' },
    { name: 'Delivered', value: projects.filter(p => p.status === 'delivered').length, color: '#F59E0B' },
    { name: 'In Progress', value: projects.filter(p => p.status === 'in_progress').length, color: '#6366F1' },
    { name: 'On Hold', value: projects.filter(p => p.status === 'on_hold').length, color: '#06B6D4' },
    { name: 'Pending', value: projects.filter(p => p.status === 'pending').length, color: '#9191A4' },
  ].filter(d => d.value > 0)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Analytics</h2>
        <p className="text-sm text-text-secondary mt-0.5">12-month business performance overview</p>
      </div>

      {/* Summary stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} iconColor="bg-primary/10 text-primary" />
        <StatCard title="Total Profit" value={formatCurrency(totalProfit)} icon={TrendingUp} iconColor={totalProfit >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'} />
        <StatCard title="Profit Margin" value={`${margin}%`} icon={TrendingUp} iconColor="bg-accent-cyan/10 text-accent-cyan" />
        <StatCard title="Active Projects" value={String(projects.filter(p => p.status === 'in_progress').length)} icon={FolderKanban} iconColor="bg-primary/10 text-primary" />
      </motion.div>

      {/* Revenue vs Expenses */}
      <motion.div variants={itemVariants}>
        <Card title="Revenue vs Expenses (12 months)" padding={false}>
          <div className="px-5 pb-5 pt-3">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9191A4', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9191A4', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name === 'revenue' ? 'Revenue' : 'Expenses']} cursor={{ fill: '#1E1E2A' }} />
                <Legend formatter={v => <span style={{ color: '#9191A4', fontSize: 11 }}>{v === 'revenue' ? 'Revenue' : 'Expenses'}</span>} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      {/* Profit trend + Service breakdown */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Profit Trend" padding={false}>
          <div className="px-5 pb-5 pt-3">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="analyticsProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9191A4', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9191A4', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Profit']} />
                <Area type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} fill="url(#analyticsProfit)"
                  dot={{ fill: '#10B981', r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Service-wise Revenue" padding={false}>
          <div className="px-5 pb-5 pt-3">
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <XAxis type="number" tick={{ fill: '#9191A4', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#9191A4', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']} cursor={{ fill: '#1E1E2A' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                    {serviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-text-muted text-sm">No service data</div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Project Status + Task Analytics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Project Status Breakdown" padding={false}>
          <div className="px-5 pb-5 pt-3">
            {projectStatusData.length > 0 ? (
              (() => {
                const totalProjects = projectStatusData.reduce((sum, entry) => sum + entry.value, 0);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
                    {/* Chart container */}
                    <div className="sm:col-span-3 relative flex items-center justify-center h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={projectStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={90}
                            paddingAngle={5}
                            cornerRadius={5}
                            dataKey="value"
                          >
                            {projectStatusData.map((entry, index) => (
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
                      {projectStatusData.map((entry, index) => {
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
              <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">No projects</div>
            )}
          </div>
        </Card>

        <Card title="Team Task Analytics" padding={false}>
          <div className="px-5 pb-5 pt-3 space-y-4">
            <div className="grid grid-cols-2 gap-4 mt-3">
              {[
                { label: 'Total Tasks', value: tasks.length, color: 'text-text' },
                { label: 'Completed', value: completedTasks, color: 'text-success' },
                { label: 'Pending', value: pendingTasks, color: 'text-warning' },
                { label: 'Completion Rate', value: `${tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%`, color: 'text-primary' },
              ].map(stat => (
                <div key={stat.label} className="bg-bg rounded-lg p-4 border border-border">
                  <p className="text-xs text-text-muted mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-text-muted mb-1.5">
                <span>Completion Rate</span>
                <span>{tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
