'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { generateICS } from '@/lib/ics'

// ─────────────────────────────────────────────────────────────
// Utility — strip HTML to plain text
// Handles TipTap/rich-text HTML stored in task descriptions
// ─────────────────────────────────────────────────────────────
function stripHtml(html: string | null | undefined): string | undefined {
  if (!html) return undefined
  return html
    // Remove script/style blocks entirely
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Replace block-level tags with a space
    .replace(/<\/(p|div|li|br|h[1-6]|blockquote|td|th)>/gi, ' ')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim() || undefined
}


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CalendarEventColor =
  | 'orange'   // task deadlines
  | 'blue'     // project milestones
  | 'red'      // invoice due dates
  | 'cyan'     // meetings
  | 'purple'   // leave
  | 'green'    // reminders
  | 'amber'    // billing dates
  | 'gray'     // custom

export type UnifiedCalendarEvent = {
  id: string
  type: 'task' | 'project_start' | 'project_deadline' | 'project_delivery' | 'billing' | 'invoice_due' | 'prospect' | 'meeting' | 'reminder' | 'milestone' | 'leave' | 'custom'
  title: string
  description?: string | null
  start: Date
  end?: Date | null
  allDay: boolean
  color: CalendarEventColor
  sourceType?: string | null
  sourceId?: string | null
  // Extra meta for the detail sidebar
  meta?: Record<string, any>
}

// ─────────────────────────────────────────────────────────────
// Aggregator — single source of truth
// ─────────────────────────────────────────────────────────────

export async function getCalendarEvents(from: Date, to: Date): Promise<UnifiedCalendarEvent[]> {
  const events: UnifiedCalendarEvent[] = []

  // ── Resolve current user & role ────────────────────────────
  const session = await auth()
  const userId = session?.user?.id

  // Look up role from DB (JWT may be stale)
  const dbUser = userId
    ? await prisma.user.findUnique({ where: { id: userId }, include: { role: true } })
    : null
  const isAdmin = dbUser?.role?.name === 'admin'

  const rangeStart = new Date(from)
  const rangeEnd = new Date(to)

  const [tasks, projects, invoices, prospects, customEvents] = await Promise.all([
    // 1. Tasks with deadlines in range
    prisma.task.findMany({
      where: {
        deadline: { gte: rangeStart, lte: rangeEnd },
        status: { not: 'completed' },
        // Non-admin: only tasks they are assigned to or created by them
        ...(!isAdmin && userId ? {
          OR: [
            { assigned_member_ids: { has: userId } },
            { assigned_by: userId },
          ],
        } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    }),

    // 2. Projects with relevant dates in range
    prisma.project.findMany({
      where: {
        AND: [
          // Must have at least one date in range
          {
            OR: [
              { start_date: { gte: rangeStart, lte: rangeEnd } },
              { expected_completion: { gte: rangeStart, lte: rangeEnd } },
              { delivery_date: { gte: rangeStart, lte: rangeEnd } },
              { next_billing_date: { gte: rangeStart, lte: rangeEnd } },
            ],
          },
          // Non-admin: must be team lead or assigned member
          ...(!isAdmin && userId
            ? [{
                OR: [
                  { team_lead_id: userId },
                  { assigned_member_ids: { has: userId } },
                ],
              }]
            : []),
        ],
      },
      include: {
        client: { select: { name: true } },
      },
    }),

    // 3. Invoices with due dates in range (non-paid)
    // Non-admin: only invoices for their projects
    isAdmin
      ? prisma.invoice.findMany({
          where: {
            due_date: { gte: rangeStart, lte: rangeEnd },
            status: { not: 'paid' },
          },
          include: {
            client: { select: { name: true } },
            project: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    // 4. Prospects — admin/sales only
    isAdmin
      ? prisma.prospect.findMany({
          where: {
            proposal_submission_date: { gte: rangeStart, lte: rangeEnd },
          },
        })
      : Promise.resolve([]),

    // 5. Custom CalendarEvents in range
    prisma.calendarEvent.findMany({
      where: {
        is_cancelled: false,
        start_date: { gte: rangeStart, lte: rangeEnd },
        // Non-admin: only their own custom events
        ...(!isAdmin && userId ? { created_by: userId } : {}),
      },
    }),
  ])

  // ── Map tasks ──────────────────────────────────────────────
  for (const task of tasks) {
    if (!task.deadline) continue
    events.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      description: stripHtml(task.description),
      start: task.deadline,
      end: task.deadline,
      allDay: true,
      color: 'orange',
      sourceType: 'task',
      sourceId: task.id,
      meta: {
        status: task.status,
        priority: task.priority,
        project: task.project?.name,
      },
    })
  }

  // ── Map projects ───────────────────────────────────────────
  for (const project of projects) {
    if (project.start_date && project.start_date >= rangeStart && project.start_date <= rangeEnd) {
      events.push({
        id: `project-start-${project.id}`,
        type: 'project_start',
        title: `${project.name} - Kicks Off`,
        description: project.client ? `Client: ${project.client.name}` : undefined,
        start: project.start_date,
        allDay: true,
        color: 'blue',
        sourceType: 'project',
        sourceId: project.id,
        meta: { status: project.status },
      })
    }
    if (project.expected_completion && project.expected_completion >= rangeStart && project.expected_completion <= rangeEnd) {
      events.push({
        id: `project-deadline-${project.id}`,
        type: 'project_deadline',
        title: `${project.name} - Expected Completion`,
        description: project.client ? `Client: ${project.client.name}` : undefined,
        start: project.expected_completion,
        allDay: true,
        color: 'blue',
        sourceType: 'project',
        sourceId: project.id,
        meta: { status: project.status },
      })
    }
    if (project.delivery_date && project.delivery_date >= rangeStart && project.delivery_date <= rangeEnd) {
      events.push({
        id: `project-delivery-${project.id}`,
        type: 'project_delivery',
        title: `${project.name} - Delivery`,
        description: project.client ? `Client: ${project.client.name}` : undefined,
        start: project.delivery_date,
        allDay: true,
        color: 'blue',
        sourceType: 'project',
        sourceId: project.id,
        meta: { status: project.status },
      })
    }
    if (project.next_billing_date && project.next_billing_date >= rangeStart && project.next_billing_date <= rangeEnd) {
      events.push({
        id: `billing-${project.id}`,
        type: 'billing',
        title: `${project.name} - Billing`,
        description: project.client ? `Client: ${project.client.name}` : undefined,
        start: project.next_billing_date,
        allDay: true,
        color: 'amber',
        sourceType: 'project',
        sourceId: project.id,
        meta: { billing_cycle: project.billing_cycle },
      })
    }
  }

  // ── Map invoices ───────────────────────────────────────────
  for (const invoice of invoices) {
    if (!invoice.due_date) continue
    events.push({
      id: `invoice-${invoice.id}`,
      type: 'invoice_due',
      title: `${invoice.invoice_number} Due`,
      description: [
        invoice.client?.name,
        invoice.project?.name,
        `₹${invoice.final_billing.toLocaleString('en-IN')}`,
      ].filter(Boolean).join(' · '),
      start: invoice.due_date,
      allDay: true,
      color: 'red',
      sourceType: 'invoice',
      sourceId: invoice.id,
      meta: { status: invoice.status, amount: invoice.final_billing },
    })
  }

  // ── Map prospects ──────────────────────────────────────────
  for (const prospect of prospects) {
    if (!prospect.proposal_submission_date) continue
    events.push({
      id: `prospect-${prospect.id}`,
      type: 'prospect',
      title: `Proposal - ${prospect.name}`,
      description: prospect.company_name ?? undefined,
      start: prospect.proposal_submission_date,
      allDay: true,
      color: 'cyan',
      sourceType: 'prospect',
      sourceId: prospect.id,
      meta: { email: prospect.email, mobile: prospect.mobile },
    })
  }

  // ── Map custom events ──────────────────────────────────────
  const colorMap: Record<string, CalendarEventColor> = {
    meeting: 'cyan',
    reminder: 'green',
    milestone: 'blue',
    leave: 'purple',
    custom: 'gray',
  }
  for (const evt of customEvents) {
    events.push({
      id: `custom-${evt.id}`,
      type: evt.type as any,
      title: evt.title,
      description: evt.description,
      start: evt.start_date,
      end: evt.end_date,
      allDay: evt.all_day,
      color: (evt.color as CalendarEventColor) ?? colorMap[evt.type] ?? 'gray',
      sourceType: evt.source_type,
      sourceId: evt.source_id,
      meta: { attendees: evt.attendee_ids },
    })
  }

  // Sort by start date
  events.sort((a, b) => a.start.getTime() - b.start.getTime())

  return events
}

// ─────────────────────────────────────────────────────────────
// Custom Event CRUD
// ─────────────────────────────────────────────────────────────

export async function createCalendarEvent(data: {
  type: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  all_day?: boolean
  color?: string
  attendee_ids?: string[]
}) {
  try {
    const session = await auth()
    const event = await prisma.calendarEvent.create({
      data: {
        type: data.type as any,
        title: data.title,
        description: data.description,
        start_date: new Date(data.start_date),
        end_date: data.end_date ? new Date(data.end_date) : null,
        all_day: data.all_day ?? false,
        color: data.color,
        attendee_ids: data.attendee_ids ?? [],
        created_by: session?.user?.id,
      },
    })
    revalidatePath('/calendar')
    return { success: true, event }
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return { success: false, error: 'Failed to create event' }
  }
}

export async function updateCalendarEvent(
  id: string,
  data: {
    type?: string
    title?: string
    description?: string
    start_date?: string
    end_date?: string
    all_day?: boolean
    color?: string
    attendee_ids?: string[]
  }
) {
  try {
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type as any }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.start_date && { start_date: new Date(data.start_date) }),
        ...(data.end_date !== undefined && { end_date: data.end_date ? new Date(data.end_date) : null }),
        ...(data.all_day !== undefined && { all_day: data.all_day }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.attendee_ids !== undefined && { attendee_ids: data.attendee_ids }),
      },
    })
    revalidatePath('/calendar')
    return { success: true, event }
  } catch (error) {
    console.error('Error updating calendar event:', error)
    return { success: false, error: 'Failed to update event' }
  }
}

export async function deleteCalendarEvent(id: string) {
  try {
    await prisma.calendarEvent.update({
      where: { id },
      data: { is_cancelled: true },
    })
    revalidatePath('/calendar')
    return { success: true }
  } catch (error) {
    console.error('Error deleting calendar event:', error)
    return { success: false, error: 'Failed to delete event' }
  }
}

// ─────────────────────────────────────────────────────────────
// ICS Export — returns full ICS string for the requesting user
// ─────────────────────────────────────────────────────────────

export async function exportICS(): Promise<string> {
  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const to = new Date()
  to.setMonth(to.getMonth() + 6)

  const events = await getCalendarEvents(from, to)

  const icsEvents = events.map((e) => ({
    uid: e.id,
    summary: e.title,
    description: e.description ?? undefined,
    dtStart: e.start,
    dtEnd: e.end ?? undefined,
    allDay: e.allDay,
    categories: [e.type],
  }))

  return generateICS(icsEvents, 'AgencyOS Calendar')
}
