'use client'

import { format, isSameDay, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'
import { EventChip } from './event-chip'

interface CalendarDayViewProps {
  currentDate: Date
  events: UnifiedCalendarEvent[]
  onEventClick?: (event: UnifiedCalendarEvent) => void
}

export default function CalendarDayView({
  currentDate,
  events,
  onEventClick,
}: CalendarDayViewProps) {
  const dayEvents = events.filter((e) => isSameDay(e.start, currentDate))
  const allDayEvents = dayEvents.filter((e) => e.allDay)
  const timedEvents = dayEvents.filter((e) => !e.allDay)
  const today = isToday(currentDate)

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold',
            today ? 'bg-primary text-primary-foreground' : 'bg-bg-tertiary text-text'
          )}
        >
          {format(currentDate, 'd')}
        </div>
        <div>
          <div className="text-sm font-semibold text-text">{format(currentDate, 'EEEE')}</div>
          <div className="text-xs text-text-muted">{format(currentDate, 'MMMM yyyy')}</div>
        </div>
        <div className="ml-auto text-sm text-text-muted">
          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* All-day band */}
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 bg-bg-secondary/50 border-b border-border space-y-1">
          <div className="text-[10px] text-text-muted font-semibold uppercase mb-1.5">All Day</div>
          {allDayEvents.map((evt) => (
            <EventChip key={evt.id} event={evt} onClick={onEventClick} />
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-16 shrink-0 border-r border-border">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="h-16 border-b border-border/40 px-2 flex items-start pt-1">
                <span className="text-[10px] text-text-muted font-medium">
                  {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Events column */}
          <div className={cn('flex-1 relative', today && 'bg-primary/[0.015]')}>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="h-16 border-b border-border/30" />
            ))}
            {/* Timed events */}
            <div className="absolute inset-x-2 top-0 space-y-1 pt-1">
              {timedEvents.map((evt) => (
                <div key={evt.id} className="relative">
                  <EventChip event={evt} onClick={onEventClick} />
                  <div className="text-[10px] text-text-muted pl-5 -mt-0.5">
                    {format(evt.start, 'h:mm a')}
                    {evt.end && ` — ${format(evt.end, 'h:mm a')}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
