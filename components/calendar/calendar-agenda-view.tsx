'use client'

import { format, isToday, isSameDay, addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent, CalendarEventColor } from '@/app/actions/calendar'

const COLOR_STYLES: Record<CalendarEventColor, string> = {
  orange: 'border-border bg-orange-500/10 hover:bg-orange-500/15',
  blue:   'border-border bg-blue-500/10 hover:bg-blue-500/15',
  red:    'border-border bg-red-500/10 hover:bg-red-500/15',
  cyan:   'border-border bg-cyan-500/10 hover:bg-cyan-500/15',
  purple: 'border-border bg-purple-500/10 hover:bg-purple-500/15',
  green:  'border-border bg-green-500/10 hover:bg-green-500/15',
  amber:  'border-border bg-amber-500/10 hover:bg-amber-500/15',
  gray:   'border-border bg-white/5 hover:bg-white/10',
}

const COLOR_TEXT: Record<CalendarEventColor, string> = {
  orange: 'text-orange-300',
  blue:   'text-blue-300',
  red:    'text-red-300',
  cyan:   'text-cyan-300',
  purple: 'text-purple-300',
  green:  'text-green-300',
  amber:  'text-amber-300',
  gray:   'text-white/60',
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  project_start: 'Project',
  project_deadline: 'Project',
  project_delivery: 'Project',
  billing: 'Billing',
  invoice_due: 'Invoice',
  prospect: 'Prospect',
  meeting: 'Meeting',
  reminder: 'Reminder',
  milestone: 'Milestone',
  leave: 'Leave',
  custom: 'Event',
}

interface CalendarAgendaViewProps {
  currentDate: Date
  events: UnifiedCalendarEvent[]
  onEventClick?: (event: UnifiedCalendarEvent) => void
  onDayClick?: (date: Date) => void
  daysAhead?: number
}

export default function CalendarAgendaView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
  daysAhead = 60,
}: CalendarAgendaViewProps) {
  // Group events into day buckets for the next N days
  const dayBuckets: Array<{ date: Date; events: UnifiedCalendarEvent[] }> = []

  for (let i = 0; i < daysAhead; i++) {
    const day = addDays(currentDate, i)
    const dayEvents = events.filter((e) => isSameDay(e.start, day))
    if (dayEvents.length > 0) {
      dayBuckets.push({ date: day, events: dayEvents })
    }
  }

  if (dayBuckets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
        <div className="text-4xl">🗓️</div>
        <p className="text-sm font-medium">No upcoming events in the next {daysAhead} days</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      <div className="space-y-6">
        {dayBuckets.map(({ date, events: dayEvents }) => {
          const today = isToday(date)
          return (
            <div key={date.toISOString()} className="flex gap-4">
              {/* Date column (interactive button to transition views) */}
              <button
                onClick={() => onDayClick?.(date)}
                disabled={!onDayClick}
                className="w-20 shrink-0 pt-0.5 text-left group cursor-pointer disabled:cursor-default"
                title="Go to day view"
              >
                <div
                  className={cn(
                    'text-center rounded-xl px-2 py-2 border transition-all',
                    today
                      ? 'bg-primary/10 border-border group-hover:bg-primary/15'
                      : 'bg-bg-tertiary border-transparent group-hover:bg-bg-tertiary/75'
                  )}
                >
                  <div className={cn('text-xs font-semibold uppercase', today ? 'text-primary font-bold' : 'text-text-muted')}>
                    {format(date, 'EEE')}
                  </div>
                  <div className={cn('text-2xl font-bold leading-tight', today ? 'text-primary' : 'text-text')}>
                    {format(date, 'd')}
                  </div>
                  <div className={cn('text-[10px]', today ? 'text-primary/80' : 'text-text-muted')}>
                    {format(date, 'MMM')}
                  </div>
                </div>
              </button>

              {/* Events column */}
              <div className="flex-1 space-y-2">
                {dayEvents.map((evt) => {
                  const colorStyle = COLOR_STYLES[evt.color] ?? COLOR_STYLES.gray
                  const colorText = COLOR_TEXT[evt.color] ?? COLOR_TEXT.gray
                  const label = TYPE_LABELS[evt.type] ?? 'Event'

                  return (
                    <button
                      key={evt.id}
                      onClick={() => onEventClick?.(evt)}
                      className={cn(
                        'w-full text-left rounded-lg border px-4 py-3 transition-all hover:opacity-90 cursor-pointer',
                        colorStyle
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-text truncate">{evt.title}</div>
                          {evt.description && (
                            <div className="text-xs text-text-muted mt-0.5 line-clamp-1">{evt.description}</div>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className={cn('text-[10px] font-semibold uppercase', colorText)}>{label}</span>
                          {!evt.allDay && (
                            <span className="text-[10px] text-text-muted">
                              {format(evt.start, 'h:mm a')}
                            </span>
                          )}
                          {evt.allDay && (
                            <span className="text-[10px] text-text-muted">All day</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
