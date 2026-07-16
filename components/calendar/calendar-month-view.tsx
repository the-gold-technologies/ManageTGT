'use client'

import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, addDays,
} from 'date-fns'
import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'
import { EventChip } from './event-chip'

interface CalendarMonthViewProps {
  currentDate: Date
  events: UnifiedCalendarEvent[]
  onDayClick?: (date: Date) => void
  onEventClick?: (event: UnifiedCalendarEvent) => void
}

export default function CalendarMonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(e.start, day))
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: '1fr' }}>
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const MAX_VISIBLE = 3

          return (
            <div
              key={idx}
              onClick={() => onDayClick?.(day)}
              className={cn(
                'group relative p-1.5 border-r border-b border-border cursor-pointer transition-colors',
                isCurrentMonth ? 'bg-transparent hover:bg-bg-tertiary/50' : 'bg-bg/30',
                (idx + 1) % 7 === 0 && 'border-r-0',
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors',
                    today
                      ? 'bg-primary text-primary-foreground'
                      : isCurrentMonth
                      ? 'text-text group-hover:text-text'
                      : 'text-text-muted',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayEvents.length > MAX_VISIBLE && (
                  <span className="text-[10px] text-text-muted pr-0.5">
                    +{dayEvents.length - MAX_VISIBLE}
                  </span>
                )}
              </div>

              {/* Event chips */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map((evt) => (
                  <EventChip
                    key={evt.id}
                    event={evt}
                    onClick={onEventClick}
                    compact
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
