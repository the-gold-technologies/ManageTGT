'use client'

import { useState } from 'react'
import { formatCurrency, calculateMargin } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import StatCard from '@/components/ui/stat-card'
import { TrendingUp, TrendingDown, DollarSign, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { getProfitabilityData } from '@/app/actions/profitability'
import { motion, Variants } from 'framer-motion'
import DateFilterDropdown, { DateFilterValue } from '@/components/ui/date-filter-dropdown'
import ExportDropdown from '@/components/ui/export-dropdown'
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfQuarter, endOfYear } from 'date-fns'

function getDateRange(filter: DateFilterValue, customStart: Date | null, customEnd: Date | null): { start: Date | null, end: Date | null } {
  const now = new Date()
  switch (filter) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) }
    case 'this_week': return { start: startOfWeek(now), end: endOfWeek(now) }
    case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'this_quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) }
    case 'this_year': return { start: startOfYear(now), end: endOfYear(now) }
    case 'custom': return { start: customStart, end: customEnd }
    default: return { start: null, end: null }
  }
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

export default function ProfitabilityClient() {
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null)
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null)

  const { start, end } = getDateRange(dateFilter, customDateStart, customDateEnd)

  const { data, isLoading } = useQuery({
    queryKey: ['profitability', start?.toISOString(), end?.toISOString()],
    queryFn: async () => {
      return await getProfitabilityData(start?.toISOString(), end?.toISOString())
    }
  })

  const profitData = data ?? []

  const filtered = profitData.filter(p => {
    const s = search.toLowerCase()
    return p.name.toLowerCase().includes(s) || 
           p.project_code.toLowerCase().includes(s) || 
           (p.client || '').toLowerCase().includes(s)
  })

  const totalRevenue = filtered.reduce((s, p) => s + p.revenue, 0)
  const totalExpenses = filtered.reduce((s, p) => s + p.expense, 0)
  const totalProfit = totalRevenue - totalExpenses
  const overallMargin = calculateMargin(totalRevenue, totalProfit)

  const exportHeaders = ['Project', 'Client', 'Revenue', 'Expenses', 'Profit', 'Margin']
  const mapExportData = (p: any) => [
    `${p.name} (${p.project_code})`,
    p.client,
    p.revenue,
    p.expense,
    p.profit,
    `${p.margin}%`
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Profitability</h2>
          <p className="text-sm text-text-secondary mt-0.5">Revenue minus expenses per project</p>
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2 lg:gap-3 shrink-0 w-full sm:w-auto">
          <div className="relative shrink-0 w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all h-[36px]"
            />
          </div>

          <div className="shrink-0">
            <DateFilterDropdown
              value={dateFilter}
              onChange={setDateFilter}
              onCustomDateChange={(s, e) => {
                setCustomDateStart(s); setCustomDateEnd(e); setDateFilter('custom');
              }} 
            />
          </div>

          <div className="shrink-0">
            <ExportDropdown 
              data={filtered} 
              headers={exportHeaders} 
              filename={`profitability_export_${new Date().toISOString().split('T')[0]}`} 
              mapData={mapExportData} 
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-bg-secondary rounded-xl"></div>)}
        </div>
      ) : (
        <motion.div variants={itemVariants} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} iconColor="bg-primary/10 text-primary" />
          <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={DollarSign} iconColor="bg-danger/10 text-danger" />
          <StatCard title="Net Profit" value={formatCurrency(totalProfit)} icon={TrendingUp} iconColor={totalProfit >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'} />
          <StatCard title="Overall Margin" value={`${overallMargin}%`} icon={TrendingUp} iconColor="bg-accent-cyan/10 text-accent-cyan" />
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Card padding={false}>
          {isLoading ? (
            <div className="h-[400px] bg-bg-secondary rounded-lg animate-pulse m-5"></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-tertiary border-b border-border">
                    {['Project', 'Client', 'Revenue', 'Expenses', 'Profit', 'Margin'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-text-muted">No profitability data found</td>
                    </tr>
                  ) : (
                    filtered.map(row => (
                      <tr key={row.id} className="border-b border-border hover:bg-bg-tertiary transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-text">{row.name}</p>
                          <p className="text-[10px] font-mono text-text-muted mt-0.5">{row.project_code}</p>
                        </td>
                        <td className="px-5 py-3 text-text-secondary">{row.client}</td>
                        <td className="px-5 py-3 text-text font-medium">{formatCurrency(row.revenue)}</td>
                        <td className="px-5 py-3 text-text font-medium">{formatCurrency(row.expense)}</td>
                        <td className={cn("px-5 py-3 font-bold", row.profit >= 0 ? 'text-success' : 'text-danger')}>
                          {formatCurrency(row.profit)}
                        </td>
                        <td className="px-5 py-3">
                          <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            row.margin >= 20 ? 'bg-success/10 text-success' :
                            row.margin > 0 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                          )}>
                            {row.margin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {row.margin}%
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
