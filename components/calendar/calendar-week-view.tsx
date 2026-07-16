'use client'

import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isToday, addDays,
} from 'date-fns'
import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'
import { EventChip } from './event-chip'

interface CalendarWeekViewProps {
  currentDate: Date
  events: UnifiedCalendarEvent[]
  onEventClick?: (event: UnifiedCalendarEvent) => void
  onDayClick?: (date: Date) => void
}

export default function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(e.start, day))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day header row */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: '4rem repeat(7, 1fr)' }}>
        <div className="border-r border-border" />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick?.(day)}
              className="py-3 text-center cursor-pointer hover:bg-bg-tertiary/50 transition-colors border-r border-border last:border-r-0"
            >
              <div className="text-xs text-text-muted font-medium uppercase">
                {format(day, 'EEE')}
              </div>
              <div
                className={cn(
                  'mt-0.5 mx-auto flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold',
                  today ? 'bg-primary text-primary-foreground' : 'text-text'
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day events row */}
      {(() => {
        const allDayEvents = events.filter(e => e.allDay)
        if (allDayEvents.length === 0) return null
        return (
          <div className="grid border-b border-border bg-bg-secondary/50" style={{ gridTemplateColumns: '4rem repeat(7, 1fr)' }}>
            <div className="py-1 px-2 text-[10px] text-text-muted font-medium border-r border-border flex items-center">
              ALL DAY
            </div>
            {days.map((day) => {
              const dayAllDay = allDayEvents.filter(e => isSameDay(e.start, day))
              return (
                <div key={day.toISOString()} className="p-1 border-r border-border last:border-r-0 space-y-0.5 min-h-[2rem]">
                  {dayAllDay.map(evt => (
                    <EventChip key={evt.id} event={evt} onClick={onEventClick} compact />
                  ))}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Timed events */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: '4rem repeat(7, 1fr)' }}>
          {/* Time gutter */}
          <div className="border-r border-border">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="h-14 border-b border-border/50 px-2 flex items-start pt-1">
                <span className="text-[10px] text-text-muted font-medium">
                  {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const timedEvents = events.filter(e => !e.allDay && isSameDay(e.start, day))
            const today = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative border-r border-border last:border-r-0',
                  today && 'bg-primary/[0.02]'
                )}
              >
                {/* Hour lines */}
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="h-14 border-b border-border/30" />
                ))}
                {/* Timed event chips stacked */}
                <div className="absolute inset-0 p-0.5 space-y-0.5 pointer-events-none">
                  {timedEvents.map(evt => (
                    <div key={evt.id} className="pointer-events-auto">
                      <EventChip event={evt} onClick={onEventClick} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
