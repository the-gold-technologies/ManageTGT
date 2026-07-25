import { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import {
  startOfMonth, endOfMonth, addMonths,
} from 'date-fns'
import { getCalendarEvents } from '@/app/actions/calendar'
import { getGoogleConnectionStatus } from '@/app/actions/google-oauth'
import CalendarClient from '@/components/calendar/calendar-client'

export const metadata: Metadata = {
  title: 'Calendar - AgencyOS',
  description: 'Unified view of all tasks, project milestones, invoice deadlines, meetings and events across your agency.',
}

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Pre-fetch events for current month + next 2 months for agenda
  const now = new Date()
  const from = startOfMonth(now)
  const to = endOfMonth(addMonths(now, 2))

  const [events, googleConnected] = await Promise.all([
    getCalendarEvents(from, to),
    getGoogleConnectionStatus(session.user.id),
  ])

  // Serialize dates to strings (Next.js server → client boundary)
  const serializedEvents = events.map((e) => ({
    ...e,
    start: e.start.toISOString(),
    end: e.end ? e.end.toISOString() : null,
  }))

  return (
    // height: 100dvh minus topbar (h-16 = 4rem); -m-6 removes main's p-6 padding
    <div className="-m-6 overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      <CalendarClient
        initialEvents={serializedEvents as any}
        initialFrom={from.toISOString()}
        initialTo={to.toISOString()}
        eventCount={serializedEvents.length}
        googleConnected={googleConnected}
      />
    </div>
  )
}
