'use server'

import prisma from '@/lib/prisma'
import { getCalendarEvents } from './calendar'
import { auth } from '@/auth'

export async function getDashboardData() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({ 
    where: { id: session?.user?.id || '' },
    include: { role: true }
  })
  const userRole = dbUser?.role?.name || 'team_member'

  const DEFAULT_MODULES = ['dashboard', 'settings', 'tasks', 'calendar', 'files']
  let allowedModules: string[] = [...DEFAULT_MODULES]
  const roleId = dbUser?.roleId
  if (roleId) {
    const accessRecords = await prisma.roleModuleAccess.findMany({
      where: { roleId, hasAccess: true }
    })
    allowedModules = Array.from(new Set([...allowedModules, ...accessRecords.map(a => a.moduleKey)]))
  }
  if (userRole === 'admin') {
    allowedModules = ['dashboard', 'clients', 'projects', 'tasks', 'revenue', 'expenses', 'profitability', 'prospects', 'targets', 'analytics', 'team', 'activity', 'settings']
  }

  let projectsWhere: any = {}
  if (userRole === 'team_lead') {
    projectsWhere = { team_lead_id: session?.user?.id }
  }

  const [
    projects,
    invoices,
    expenses,
    targets,
    closures,
    userTasks,
    sharedFiles,
  ] = await Promise.all([
    allowedModules.includes('projects') ? prisma.project.findMany({ where: projectsWhere, select: { id: true, status: true, expected_completion: true, createdAt: true, billing_cycle: true, quoted_price: true } }) : Promise.resolve([]),
    allowedModules.includes('revenue') ? prisma.invoice.findMany({ select: { final_billing: true, amount_received: true, status: true, createdAt: true, gst_applied: true } }) : Promise.resolve([]),
    allowedModules.includes('expenses') ? prisma.expense.findMany({ select: { amount: true, createdAt: true } }) : Promise.resolve([]),
    allowedModules.includes('targets') ? prisma.salesTarget.findMany({ where: { month: new Date().getMonth() + 1, year: new Date().getFullYear() } }) : Promise.resolve([]),
    allowedModules.includes('targets') ? prisma.salesClosure.findMany({ select: { target_id: true, closed_at: true } }) : Promise.resolve([]),
    userRole !== 'admin' ? prisma.task.findMany({
      where: { assigned_member_ids: { has: session?.user?.id || '' } },
      include: { project: { select: { name: true } } },
      orderBy: { deadline: 'asc' }
    }) : Promise.resolve([]),
    userRole !== 'admin' ? prisma.fileRecord.findMany({
      where: {
        is_archived: false,
        OR: [
          { shared_with: { has: session?.user?.id || '' } },
          { uploaded_by: session?.user?.id || '' },
          {
            project: {
              OR: [
                { team_lead_id: session?.user?.id || '' },
                { assigned_member_ids: { has: session?.user?.id || '' } }
              ]
            }
          },
          {
            task: {
              OR: [
                { assigned_by: session?.user?.id || '' },
                { assigned_member_ids: { has: session?.user?.id || '' } }
              ]
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }) : Promise.resolve([]),
  ])

  const unifiedEvents = await getCalendarEvents(
    new Date(new Date().getFullYear(), 0, 1),
    new Date(new Date().getFullYear() + 1, 0, 1)
  )

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Revenue
  const totalRevenue = (invoices ?? []).reduce((s, i) => s + (i.gst_applied ? (i.amount_received || 0) / 1.18 : (i.amount_received || 0)), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.amount || 0), 0)
  const totalProfit = totalRevenue - totalExpenses

  // Recurring Revenue
  const mrr = (projects ?? [])
    .filter(p => (p.status === 'in_progress' || p.status === 'delivered') && p.billing_cycle === 'MONTHLY')
    .reduce((s, p) => s + (p.quoted_price || 0), 0)
  const arr = (projects ?? [])
    .filter(p => (p.status === 'in_progress' || p.status === 'delivered') && p.billing_cycle === 'ANNUAL')
    .reduce((s, p) => s + (p.quoted_price || 0), 0)

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
        const invDate = new Date(inv.createdAt)
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
        const invDate = new Date(inv.createdAt)
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear()
      })
      .reduce((s, inv) => s + (inv.amount_received || 0), 0)
    const monthExpenses = (expenses ?? [])
      .filter(exp => {
        const expDate = new Date(exp.createdAt)
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
        const expDate = new Date(exp.createdAt)
        return expDate.getMonth() === d.getMonth() && expDate.getFullYear() === d.getFullYear()
      })
      .reduce((s, exp) => s + (exp.amount || 0), 0)
  })

  // Pending payments per month (invoices not fully paid, by createdAt month)
  const pendingTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (invoices ?? [])
      .filter(inv => {
        const invDate = new Date(inv.createdAt)
        return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear() && inv.status !== 'paid'
      })
      .reduce((s, inv) => s + Math.max(0, (inv.final_billing || 0) - (inv.amount_received || 0)), 0)
  })

  // Active projects count per month (by createdAt)
  const activeProjectsTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (projects ?? []).filter(p => {
      const pd = new Date(p.createdAt)
      return pd.getFullYear() < d.getFullYear() ||
        (pd.getFullYear() === d.getFullYear() && pd.getMonth() <= d.getMonth())
    }).filter(p => p.status === 'in_progress').length
  })

  // Completed projects per month (by createdAt)
  const completedProjectsTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - (6 - i), 1)
    return (projects ?? []).filter(p => {
      const pd = new Date(p.createdAt)
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


  // --- Personal Workspace Data (data-driven, works for any role with task access) ---
  const taskStats = userRole !== 'admin' ? {
    total: userTasks.length,
    pending: userTasks.filter(t => t.status !== 'completed').length,
    completed: userTasks.filter(t => t.status === 'completed').length,
  } : null

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

  const overdueCount = userRole !== 'admin'
    ? userTasks.filter(t => t.deadline && t.status !== 'completed' && new Date(t.deadline) < todayStart).length
    : 0

  const dueTodayCount = userRole !== 'admin'
    ? userTasks.filter(t => {
        if (!t.deadline || t.status === 'completed') return false
        const d = new Date(t.deadline)
        return d >= todayStart && d <= todayEnd
      }).length
    : 0

  // Task counts by status (for the status mini-bars)
  const tasksByStatus = userRole !== 'admin' ? {
    todo:        userTasks.filter(t => t.status === 'todo').length,
    in_progress: userTasks.filter(t => t.status === 'in_progress').length,
    review:      userTasks.filter(t => t.status === 'review').length,
    completed:   userTasks.filter(t => t.status === 'completed').length,
  } : null

  // Upcoming tasks sorted by urgency: overdue → today → by deadline → by priority
  const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  const upcomingTasks = userRole !== 'admin'
    ? userTasks
        .filter(t => t.status !== 'completed')
        .sort((a, b) => {
          const aD = a.deadline ? new Date(a.deadline).getTime() : Infinity
          const bD = b.deadline ? new Date(b.deadline).getTime() : Infinity
          if (aD !== bD) return aD - bD
          return (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3)
        })
        .slice(0, 8)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          deadline: t.deadline?.toISOString() || null,
          projectName: t.project?.name || null,
        }))
    : []

  // Weekly activity: tasks completed per day (last 7 days)
  const weeklyActivity = userRole !== 'admin'
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
        const end = new Date(d); end.setHours(23, 59, 59, 999)
        const count = userTasks.filter(t => {
          if (!t.completion_date) return false
          const cd = new Date(t.completion_date)
          return cd >= d && cd <= end
        }).length
        return { day: d.toLocaleDateString('en', { weekday: 'short' }), completed: count }
      })
    : []

  // Recent shared files with richer metadata
  const recentFiles = userRole !== 'admin'
    ? sharedFiles.slice(0, 4).map((f: any) => ({
        id: f.id,
        name: f.name || 'Unnamed File',
        url: f.url || f.storage_path || '',
        mimeType: f.mime_type || '',
        size: f.size || null,
        createdAt: f.createdAt?.toISOString() || null,
        category: f.category || 'general',
      }))
    : []

  const pendingTasks = upcomingTasks.slice(0, 5)

  return {
    userRole,
    allowedModules,
    stats: {
      totalRevenue,
      totalProfit,
      totalExpenses,
      mrr,
      arr,
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
    taskStats,
    tasksByStatus,
    overdueCount,
    dueTodayCount,
    upcomingTasks,
    weeklyActivity,
    recentFiles,
    pendingTasks,
    sharedFiles,
    unifiedEvents,
  }
}
