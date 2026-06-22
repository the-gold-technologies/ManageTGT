'use client'

import { formatCurrency, calculateMargin } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import StatCard from '@/components/ui/stat-card'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { getProfitabilityData } from '@/app/actions/profitability'
import { motion, Variants } from 'framer-motion'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

export default function ProfitabilityClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['profitability'],
    queryFn: async () => {
      return await getProfitabilityData()
    }
  })

  const profitData = data ?? []

  const totalRevenue = profitData.reduce((s, p) => s + p.revenue, 0)
  const totalExpenses = profitData.reduce((s, p) => s + p.expense, 0)
  const totalProfit = totalRevenue - totalExpenses
  const overallMargin = calculateMargin(totalRevenue, totalProfit)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Profitability</h2>
        <p className="text-sm text-text-secondary mt-0.5">Revenue minus expenses per project</p>
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
                  {profitData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-text-muted">No profitability data found</td>
                    </tr>
                  ) : (
                    profitData.map(row => (
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
