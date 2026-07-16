'use client'

import { useState, useCallback, useTransition } from 'react'
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, startOfDay, endOfDay,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, Download, LayoutGrid,
  CalendarDays, AlignLeft, Rows3, Filter, X, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getCalendarEvents, deleteCalendarEvent } from '@/app/actions/calendar'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'

import CalendarMonthView from './calendar-month-view'
import CalendarWeekView from './calendar-week-view'
import CalendarDayView from './calendar-day-view'
import CalendarAgendaView from './calendar-agenda-view'
import EventDetailSidebar from './event-detail-sidebar'
import CalendarEventModal from './calendar-event-modal'
import { EventDot } from './event-chip'

// ─────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────

type View = 'month' | 'week' | 'day' | 'agenda'

const VIEWS: { key: View; label: string; icon: any }[] = [
  { key: 'month',  label: 'Month',  icon: LayoutGrid },
  { key: 'week',   label: 'Week',   icon: CalendarDays },
  { key: 'day',    label: 'Day',    icon: Rows3 },
  { key: 'agenda', label: 'Agenda', icon: AlignLeft },
]

const EVENT_TYPE_FILTERS = [
  { key: 'task',             label: 'Tasks',           color: 'orange' },
  { key: 'project_start',    label: 'Projects',        color: 'blue' },
  { key: 'project_deadline', label: 'Deadlines',       color: 'blue' },
  { key: 'project_delivery', label: 'Deliveries',      color: 'blue' },
  { key: 'billing',          label: 'Billing',         color: 'amber' },
  { key: 'invoice_due',      label: 'Invoices',        color: 'red' },
  { key: 'prospect',         label: 'Prospects',       color: 'cyan' },
  { key: 'meeting',          label: 'Meetings',        color: 'cyan' },
  { key: 'reminder',         label: 'Reminders',       color: 'green' },
  { key: 'milestone',        label: 'Milestones',      color: 'blue' },
  { key: 'leave',            label: 'Leave',           color: 'purple' },
  { key: 'custom',           label: 'Custom',          color: 'gray' },
] as const

// ─────────────────────────────────────────────────────────────
// Mini calendar (for sidebar)
// ─────────────────────────────────────────────────────────────
function MiniCalendar({
  selected,
  onSelect,
  events,
}: {
  selected: Date
  onSelect: (d: Date) => void
  events: UnifiedCalendarEvent[]
}) {
  const [mini, setMini] = useState(selected)
  const monthStart = startOfMonth(mini)
  const monthEnd = endOfMonth(mini)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text">{format(mini, 'MMMM yyyy')}</span>
        <div className="flex gap-1">
          <button onClick={() => setMini(subMonths(mini, 1))} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setMini(addMonths(mini, 1))} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-0.5">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="flex items-center justify-center h-6 text-[10px] font-semibold text-text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — every cell is the same height (h-9) so rows are uniform */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvts = events.filter(e => isSameDay(e.start, day))
          const inMonth = isSameMonth(day, mini)
          const sel = isSameDay(day, selected)
          const tod = isToday(day)
          return (
            <button
              key={i}
              onClick={() => { onSelect(day); setMini(day) }}
              className={cn(
                // Each cell: fixed height, centered column layout
                'flex flex-col items-center justify-center h-9 gap-0.5 transition-colors',
                !inMonth && 'opacity-30',
              )}
            >
              {/* Number chip — always w-6 h-6: guarantees a perfect square highlight */}
              <span className={cn(
                'flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-medium transition-colors',
                sel && 'bg-primary text-primary-foreground',
                !sel && tod && 'text-primary font-bold ring-1 ring-primary/40 rounded-md',
                !sel && !tod && 'text-text-secondary hover:bg-bg-tertiary hover:text-text',
              )}>
                {format(day, 'd')}
              </span>
              {/* Event dots row — fixed height so cells with/without dots stay same size */}
              <div className="flex gap-0.5 h-1.5 items-center">
                {dayEvts.length > 0 && !sel && dayEvts.slice(0, 3).map(e => (
                  <EventDot key={e.id} color={e.color} />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────

interface CalendarClientProps {
  initialEvents: Array<Omit<UnifiedCalendarEvent, 'start' | 'end'> & { start: string; end: string | null }>
  initialFrom: string
  initialTo: string
  eventCount: number
}

// Rehydrate serialized events (dates come as ISO strings across the server/client boundary)
function deserializeEvents(
  events: CalendarClientProps['initialEvents']
): UnifiedCalendarEvent[] {
  return events.map((e) => ({
    ...e,
    start: new Date(e.start),
    end: e.end ? new Date(e.end) : null,
  }))
}

export default function CalendarClient({
  initialEvents,
  initialFrom,
  initialTo,
  eventCount,
}: CalendarClientProps) {
  const [view, setView] = useState<View>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>(() => deserializeEvents(initialEvents))
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCalendarEvent | null>(null)
  const [editEvent, setEditEvent] = useState<UnifiedCalendarEvent | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultModalDate, setDefaultModalDate] = useState<Date | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Navigation ──────────────────────────────────────────────
  function navigate(dir: 1 | -1) {
    setCurrentDate((prev) => {
      if (view === 'month') return dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)
      if (view === 'week') return dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1)
      return dir === 1 ? addDays(prev, 1) : subDays(prev, 1)
    })
  }

  function goToday() { setCurrentDate(new Date()) }

  // ── Date range label ────────────────────────────────────────
  function getLabel() {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    if (view === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 })
      const e = endOfWeek(currentDate, { weekStartsOn: 1 })
      return isSameMonth(s, e)
        ? `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`
        : `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
    }
    if (view === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy')
    return `Upcoming · ${format(currentDate, 'MMMM yyyy')}`
  }

  // ── Refresh events ──────────────────────────────────────────
  const refreshEvents = useCallback(() => {
    startTransition(async () => {
      const from = view === 'month'
        ? startOfMonth(currentDate)
        : view === 'week'
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfDay(currentDate)

      const to = view === 'month'
        ? endOfMonth(currentDate)
        : view === 'week'
        ? endOfWeek(currentDate, { weekStartsOn: 1 })
        : endOfDay(currentDate)

      // Agenda: fetch 3 months ahead
      const agendaTo = addMonths(currentDate, 3)

      const fresh = await getCalendarEvents(from, view === 'agenda' ? agendaTo : to)
      // Rehydrate dates (server action boundary may return strings)
      setEvents(fresh.map(e => ({
        ...e,
        start: e.start instanceof Date ? e.start : new Date(e.start as any),
        end: e.end ? (e.end instanceof Date ? e.end : new Date(e.end as any)) : null,
      })))
      setRefreshKey(k => k + 1)
    })
  }, [view, currentDate])

  // ── Filtered events ─────────────────────────────────────────
  const filteredEvents = activeFilters.size === 0
    ? events
    : events.filter(e => {
        const base = e.type.split('_')[0]
        return activeFilters.has(e.type) || activeFilters.has(base)
      })

  // ── Toggle filter ───────────────────────────────────────────
  function toggleFilter(key: string) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Delete custom event ─────────────────────────────────────
  async function handleDelete(evt: UnifiedCalendarEvent) {
    const sourceId = evt.id.replace('custom-', '')
    const result = await deleteCalendarEvent(sourceId)
    if (result.success) {
      toast.success('Event deleted')
      setSelectedEvent(null)
      refreshEvents()
    } else {
      toast.error('Failed to delete event')
    }
  }

  // ── ICS download ────────────────────────────────────────────
  function downloadICS() {
    window.open('/api/calendar/ics', '_blank')
    toast.success('Calendar export started')
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header (lives here so New Event can open the modal) ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text">Calendar</h1>
          <p className="text-sm text-text-muted mt-0.5">All tasks, projects, invoices &amp; events in one place</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted px-2.5 py-1 bg-bg-secondary border border-border rounded-lg">
            {eventCount} events this period
          </span>
          <button
            onClick={() => { setEditEvent(null); setDefaultModalDate(currentDate); setModalOpen(true) }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover shadow-glow-sm transition-colors"
          >
            <Plus size={15} />
            New Event
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + calendar grid ─────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-4 px-3 pt-3 pb-3">
      {/* ── Left sidebar ──────────────────────────────────────── */}
      <div className="w-60 shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Mini calendar */}
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden shrink-0">
          <MiniCalendar
            selected={currentDate}
            onSelect={(d) => { setCurrentDate(d); if (view === 'month') {} else setView('day') }}
            events={events}
          />
        </div>

        {/* Legend / Quick stats */}
        <div className="bg-bg-secondary border border-border rounded-xl p-3 shrink-0">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">Legend</div>
          <div className="space-y-1.5">
            {[
              { color: 'bg-orange-400', label: 'Task deadlines' },
              { color: 'bg-blue-400',   label: 'Project dates' },
              { color: 'bg-red-400',    label: 'Invoice due' },
              { color: 'bg-amber-400',  label: 'Billing dates' },
              { color: 'bg-cyan-400',   label: 'Meetings / Proposals' },
              { color: 'bg-green-400',  label: 'Reminders' },
              { color: 'bg-purple-400', label: 'Leave' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full shrink-0', color)} />
                <span className="text-xs text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ICS export */}
        <button
          onClick={downloadICS}
          className="flex items-center gap-2 h-9 px-3 rounded-xl bg-bg-secondary border border-border text-xs text-text-muted hover:text-text hover:border-border-muted shrink-0 transition-colors"
        >
          <Download size={13} />
          Export .ics
        </button>
      </div>

      {/* ── Main calendar area ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          {/* Nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToday}
              className="px-3 h-8 rounded-lg text-xs font-medium text-text-muted hover:text-text hover:bg-bg-tertiary border border-border transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Date label */}
          <h2 className="text-sm font-semibold text-text flex-1 truncate">{getLabel()}</h2>

          {/* Refresh */}
          <button
            onClick={refreshEvents}
            disabled={isPending}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={cn(isPending && 'animate-spin')} />
          </button>

          {/* Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
              activeFilters.size > 0
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border text-text-muted hover:text-text hover:bg-bg-tertiary'
            )}
          >
            <Filter size={13} />
            Filter
            {activeFilters.size > 0 && (
              <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilters.size}
              </span>
            )}
          </button>

          {/* View switcher */}
          <div className="flex bg-bg-tertiary border border-border rounded-lg p-0.5 gap-0.5">
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                title={label}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-colors',
                  view === key
                    ? 'bg-primary text-primary-foreground shadow-glow-sm'
                    : 'text-text-muted hover:text-text'
                )}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        {showFilters && (
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-border bg-bg/40">
            {EVENT_TYPE_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium border transition-colors',
                  activeFilters.has(key)
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'border-border text-text-muted hover:text-text hover:bg-bg-tertiary'
                )}
              >
                {label}
                {activeFilters.has(key) && <X size={10} />}
              </button>
            ))}
            {activeFilters.size > 0 && (
              <button
                onClick={() => setActiveFilters(new Set())}
                className="h-6 px-2.5 rounded-full text-xs text-text-muted hover:text-danger border border-border hover:border-danger/30 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Calendar view */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {view === 'month' && (
              <CalendarMonthView
                key={`month-${refreshKey}`}
                currentDate={currentDate}
                events={filteredEvents}
                onDayClick={(d) => { setCurrentDate(d) }}
                onEventClick={setSelectedEvent}
              />
            )}
            {view === 'week' && (
              <CalendarWeekView
                key={`week-${refreshKey}`}
                currentDate={currentDate}
                events={filteredEvents}
                onEventClick={setSelectedEvent}
                onDayClick={(d) => { setCurrentDate(d); setView('day') }}
              />
            )}
            {view === 'day' && (
              <CalendarDayView
                key={`day-${refreshKey}`}
                currentDate={currentDate}
                events={filteredEvents}
                onEventClick={setSelectedEvent}
              />
            )}
            {view === 'agenda' && (
              <CalendarAgendaView
                key={`agenda-${refreshKey}`}
                currentDate={currentDate}
                events={filteredEvents}
                onEventClick={setSelectedEvent}
                onDayClick={(d) => { setCurrentDate(d); setView('day') }}
              />
            )}
          </div>

          {/* Event detail sidebar */}
          {selectedEvent && (
            <div className="w-72 border-l border-border shrink-0 overflow-hidden flex flex-col bg-bg-secondary">
              <EventDetailSidebar
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onEdit={(evt) => {
                  setEditEvent(evt)
                  setModalOpen(true)
                  setSelectedEvent(null)
                }}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </div>
      {/* Close body wrapper */}
      </div>

      {/* Event modal */}
      <CalendarEventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditEvent(null) }}
        onSuccess={refreshEvents}
        editEvent={editEvent}
        defaultDate={defaultModalDate}
      />
    </div>
  )
}
