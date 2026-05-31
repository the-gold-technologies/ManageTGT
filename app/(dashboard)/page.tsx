import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import DashboardClient from '@/components/dashboard/dashboard-client'

async function getDashboardData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id || '').single()
  const userRole = profile?.role || 'team_member'

  let projectsQuery = supabase.from('projects').select('id, status, expected_completion, created_at')
  if (userRole === 'team_lead') {
    projectsQuery = projectsQuery.eq('team_lead_id', user?.id || '')
  }

  let targetsQuery = supabase.from('sales_targets').select('*').eq('month', new Date().getMonth() + 1).eq('year', new Date().getFullYear())
  let closuresQuery = supabase.from('sales_closures').select('target_id, closed_at')

  // Parallel queries for speed
  const [
    { data: projects },
    { data: invoices },
    { data: expenses },
    { data: targets },
    { data: closures },
  ] = await Promise.all([
    ['admin', 'team_lead'].includes(userRole) ? projectsQuery : Promise.resolve({ data: [] }),
    userRole === 'admin' ? supabase.from('invoices').select('final_billing, amount_received, status, created_at') : Promise.resolve({ data: [] }),
    userRole === 'admin' ? supabase.from('expenses').select('amount, created_at') : Promise.resolve({ data: [] }),
    ['admin', 'sales_executive'].includes(userRole) ? targetsQuery : Promise.resolve({ data: [] }),
    ['admin', 'sales_executive'].includes(userRole) ? closuresQuery : Promise.resolve({ data: [] }),
  ])

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Revenue
  const totalRevenue = (invoices ?? []).reduce((s, i) => s + (i.amount_received || 0), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.amount || 0), 0)
  const totalProfit = totalRevenue - totalExpenses

  // Project stats
  const active = (projects ?? []).filter(p => p.status === 'in_progress').length
  const completed = (projects ?? []).filter(p => p.status === 'completed').length
  const pending = (projects ?? []).filter(p => p.status === 'pending').length
  const onHold = (projects ?? []).filter(p => p.status === 'on_hold').length
  const delivered = (projects ?? []).filter(p => p.status === 'delivered').length
  const overdue = (projects ?? []).filter(p => {
    if (!p.expected_completion) return false
    return new Date(p.expected_completion) < now && p.status !== 'completed' && p.status !== 'delivered'
  }).length

  // Pending payments
  const pendingPayments = (invoices ?? [])
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + ((i.final_billing || 0) - (i.amount_received || 0)), 0)

  // Monthly target
  const totalTargets = (targets ?? []).reduce((s, t) => s + t.target_count, 0)
  const targetIds = new Set((targets ?? []).map(t => t.id))
  const thisMonthClosures = (closures ?? []).filter(c =>
    targetIds.has(c.target_id) &&
    new Date(c.closed_at).getMonth() === currentMonth &&
    new Date(c.closed_at).getFullYear() === currentYear
  ).length

  // Monthly revenue chart data (last 7 months)
  const revenueTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    const monthRevenue = (invoices ?? [])
      .filter(inv => {
        const invDate = new Date(inv.created_at)
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear()
      })
      .reduce((s, inv) => s + (inv.amount_received || 0), 0)
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      revenue: monthRevenue,
    }
  })

  const profitTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    const monthRevenue = (invoices ?? [])
      .filter(inv => {
        const invDate = new Date(inv.created_at)
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear()
      })
      .reduce((s, inv) => s + (inv.amount_received || 0), 0)
    const monthExpenses = (expenses ?? [])
      .filter(exp => {
        const expDate = new Date(exp.created_at)
        return expDate.getMonth() === d.getMonth() && expDate.getFullYear() === d.getFullYear()
      })
      .reduce((s, exp) => s + (exp.amount || 0), 0)
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      profit: monthRevenue - monthExpenses,
    }
  })

  // Expenses per month (last 7 months)
  const expensesTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (expenses ?? [])
      .filter(exp => {
        const expDate = new Date(exp.created_at)
        return expDate.getMonth() === d.getMonth() && expDate.getFullYear() === d.getFullYear()
      })
      .reduce((s, exp) => s + (exp.amount || 0), 0)
  })

  // Pending payments per month (invoices not fully paid, by created_at month)
  const pendingTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (invoices ?? [])
      .filter(inv => {
        const invDate = new Date(inv.created_at)
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear() && inv.status !== 'paid'
      })
      .reduce((s, inv) => s + Math.max(0, (inv.final_billing || 0) - (inv.amount_received || 0)), 0)
  })

  // Active projects count per month (by created_at)
  const activeProjectsTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (projects ?? []).filter(p => {
      const pd = new Date(p.created_at)
      return pd.getFullYear() < d.getFullYear() ||
        (pd.getFullYear() === d.getFullYear() && pd.getMonth() <= d.getMonth())
    }).filter(p => p.status === 'in_progress').length
  })

  // Completed projects per month (by created_at)
  const completedProjectsTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (projects ?? []).filter(p => {
      const pd = new Date(p.created_at)
      return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === 'completed'
    }).length
  })

  const projectStatusData = [
    { name: 'Active', value: active, color: '#3B82F6' },
    { name: 'Completed', value: completed, color: '#10B981' },
    { name: 'Pending', value: pending, color: '#F59E0B' },
    { name: 'On Hold', value: onHold, color: '#A855F7' },
    { name: 'Delivered', value: delivered, color: '#06B6D4' },
    { name: 'Overdue', value: overdue, color: '#EF4444' },
  ].filter(d => d.value > 0)

  return {
    userRole,
    stats: {
      totalRevenue,
      totalProfit,
      totalExpenses,
      activeProjects: active,
      completedProjects: completed,
      pendingPayments,
      monthlyTarget: { achieved: thisMonthClosures, total: totalTargets },
    },
    revenueTrend,
    profitTrend,
    projectStatusData,
    expensesTrend,
    pendingTrend,
    activeProjectsTrend,
    completedProjectsTrend,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  return <DashboardClient data={data} userRole={data.userRole} />
}
