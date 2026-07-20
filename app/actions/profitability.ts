'use server'

import prisma from '@/lib/prisma'
import { calculateProfit, calculateMargin } from '@/lib/utils'

export async function getProfitabilityData() {
  const [projects, invoices, expenses] = await Promise.all([
    prisma.project.findMany({ select: { id: true, project_code: true, name: true, client: { select: { name: true } } } }),
    prisma.invoice.findMany({ select: { project_id: true, amount_received: true } }),
    prisma.expense.findMany({ select: { project_id: true, amount: true } }),
  ])

  const generalRevenue = (invoices ?? [])
    .filter(i => !i.project_id)
    .reduce((s, i) => s + (i.amount_received || 0), 0)
  const generalExpense = (expenses ?? [])
    .filter(e => !e.project_id)
    .reduce((s, e) => s + (e.amount || 0), 0)

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
  })

  if (generalRevenue > 0 || generalExpense > 0) {
    const profit = calculateProfit(generalRevenue, generalExpense)
    const margin = calculateMargin(generalRevenue, profit)
    profitData.push({
      id: 'general',
      project_code: 'GEN-EXP',
      name: 'General / Non-Project',
      client: '—',
      revenue: generalRevenue,
      expense: generalExpense,
      profit,
      margin
    })
  }

  profitData.sort((a, b) => b.profit - a.profit)

  return profitData
}
