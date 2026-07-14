'use server'

import prisma from '@/lib/prisma'

export async function getAnalyticsData() {
  const now = new Date()

  const [invoices, expenses, projects, tasks, prospects] = await Promise.all([
    prisma.invoice.findMany({ select: { amount_received: true, final_billing: true, createdAt: true, status: true } }),
    prisma.expense.findMany({ select: { amount: true, createdAt: true } }),
    prisma.project.findMany({ select: { status: true, service_type: true, quoted_price: true, createdAt: true } }),
    prisma.task.findMany({ select: { status: true, createdAt: true, completion_date: true } }),
    prisma.prospect.findMany({ select: { proposal_submitted: true, client_converted: true, createdAt: true } }),
  ])

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

  const serviceRevenue = (projects ?? []).reduce((acc, p) => {
    const types = p.service_type ? p.service_type.split(',').map(s => s.trim()) : []
    if (types.length === 0) return acc
    const pricePerService = (p.quoted_price || 0) / types.length
    types.forEach(t => {
      if (!t) return
      if (!acc[t]) acc[t] = 0
      acc[t] += pricePerService
    })
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

  return {
    monthlyData,
    serviceData,
    projects: formattedProjects,
    tasks: formattedTasks,
    prospects: formattedProspects
  }
}
