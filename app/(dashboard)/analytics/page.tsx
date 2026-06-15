import AnalyticsClient from '@/components/analytics/analytics-client'
import prisma from '@/lib/prisma'

export default async function AnalyticsPage() {
  const now = new Date()

  const [invoices, expenses, projects, tasks, prospects] = await Promise.all([
    prisma.invoice.findMany({ select: { amount_received: true, final_billing: true, createdAt: true, status: true } }),
    prisma.expense.findMany({ select: { amount: true, createdAt: true } }),
    prisma.project.findMany({ select: { status: true, service_type: true, quoted_price: true, createdAt: true } }),
    prisma.task.findMany({ select: { status: true, createdAt: true, completion_date: true, assigned_to: true } }),
    prisma.prospect.findMany({ select: { proposal_submitted: true, client_converted: true, createdAt: true } }),
  ])

  // Build 12-month data
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    const revenue = (invoices ?? []).filter(inv => {
      const id = new Date(inv.createdAt)
      return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear()
    }).reduce((s, inv) => s + (inv.amount_received || 0), 0)
    const expense = (expenses ?? []).filter(exp => {
      const ed = new Date(exp.createdAt)
      return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear()
    }).reduce((s, exp) => s + (exp.amount || 0), 0)
    return { month: label, revenue, expenses: expense, profit: revenue - expense }
  })

  // Service wise revenue
  const serviceRevenue = (projects ?? []).reduce((acc, p) => {
    if (!acc[p.service_type]) acc[p.service_type] = 0
    acc[p.service_type] += p.quoted_price || 0
    return acc
  }, {} as Record<string, number>)

  const serviceData = Object.entries(serviceRevenue).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const formattedProjects = projects.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }))
  
  const formattedTasks = tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    completion_date: t.completion_date?.toISOString() || null,
  }))

  const formattedProspects = prospects.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }))

  return <AnalyticsClient monthlyData={monthlyData} serviceData={serviceData} projects={formattedProjects as any} tasks={formattedTasks as any} prospects={formattedProspects as any} />
}

