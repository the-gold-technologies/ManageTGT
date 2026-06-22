'use server'

import prisma from '@/lib/prisma'
import { calculateProfit, calculateMargin } from '@/lib/utils'

export async function getProfitabilityData() {
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

  return profitData
}
