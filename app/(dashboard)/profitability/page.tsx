import prisma from '@/lib/prisma'
import { formatCurrency, calculateProfit, calculateMargin } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import StatCard from '@/components/ui/stat-card'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function ProfitabilityPage() {
  const [projects, invoices, expenses] = await Promise.all([
    prisma.project.findMany({ select: { id: true, project_code: true, name: true, client: { select: { name: true } } } }),
    prisma.invoice.findMany({ select: { project_id: true, amount_received: true } }),
    prisma.expense.findMany({ select: { project_id: true, amount: true } }),
  ])

  const profitData = (projects ?? []).map(project => {
    const revenue = (invoices ?? [])
      .filter(i => i.project_id === project.id)
      .reduce((s, i) => s + (i.amount_received || 0), 0)
    const expense = (expenses ?? [])
      .filter(e => e.project_id === project.id)
      .reduce((s, e) => s + (e.amount || 0), 0)
    const profit = calculateProfit(revenue, expense)
    const margin = calculateMargin(revenue, profit)
    return { id: project.id, project_code: project.project_code, name: project.name, client: (project.client as any)?.name ?? '—', revenue, expense, profit, margin }
  }).sort((a, b) => b.profit - a.profit)

  const totalRevenue = profitData.reduce((s, p) => s + p.revenue, 0)
  const totalExpenses = profitData.reduce((s, p) => s + p.expense, 0)
  const totalProfit = totalRevenue - totalExpenses
  const overallMargin = calculateMargin(totalRevenue, totalProfit)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-text">Profitability</h2>
        <p className="text-sm text-text-secondary mt-0.5">Revenue minus expenses per project</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<DollarSign size={15} />} iconColor="bg-primary/10 text-primary" />
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={<DollarSign size={15} />} iconColor="bg-danger/10 text-danger" />
        <StatCard title="Net Profit" value={formatCurrency(totalProfit)} icon={<TrendingUp size={15} />} iconColor={totalProfit >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'} />
        <StatCard title="Overall Margin" value={`${overallMargin}%`} icon={<TrendingUp size={15} />} iconColor="bg-accent-cyan/10 text-accent-cyan" />
      </div>

      <Card padding={false}>
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
              {profitData.map(row => (
                <tr key={row.id} className="border-b border-border hover:bg-bg-tertiary transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-text">{row.name}</p>
                      <p className="text-xs text-text-muted">{row.project_code}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{row.client}</td>
                  <td className="px-5 py-3 font-medium text-text">{formatCurrency(row.revenue)}</td>
                  <td className="px-5 py-3 text-danger">{formatCurrency(row.expense)}</td>
                  <td className={cn('px-5 py-3 font-semibold', row.profit >= 0 ? 'text-success' : 'text-danger')}>
                    {row.profit >= 0 ? '+' : ''}{formatCurrency(row.profit)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden max-w-16">
                        <div
                          className={cn('h-full rounded-full', row.margin >= 0 ? 'bg-success' : 'bg-danger')}
                          style={{ width: `${Math.min(Math.abs(row.margin), 100)}%` }}
                        />
                      </div>
                      <span className={cn('text-xs font-semibold', row.margin >= 0 ? 'text-success' : 'text-danger')}>
                        {row.margin}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {profitData.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-text-muted text-sm">No project data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
