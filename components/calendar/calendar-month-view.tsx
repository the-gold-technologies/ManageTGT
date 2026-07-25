'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format,
} from 'date-fns'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'
import { EventChip } from './event-chip'

interface CalendarMonthViewProps {
  currentDate: Date
  events: UnifiedCalendarEvent[]
  onDayClick?: (date: Date) => void
  onViewDay?: (date: Date) => void
  onEventClick?: (event: UnifiedCalendarEvent) => void
}

// ─────────────────────────────────────────────────────────────
// Color map for the popover event dots
// ─────────────────────────────────────────────────────────────
const DOT: Record<string, string> = {
  orange: 'bg-orange-400', blue: 'bg-blue-400', red: 'bg-red-400',
  cyan: 'bg-cyan-400', purple: 'bg-purple-400', green: 'bg-green-400',
  amber: 'bg-amber-400', gray: 'bg-white/40',
}

export default function CalendarMonthView({
  currentDate,
  events,
  onDayClick,
  onViewDay,
  onEventClick,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const numWeeks = days.length / 7

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // ── Popover state ──────────────────────────────────────────
  const [popover, setPopover] = useState<{
    day: Date
    dayEvents: UnifiedCalendarEvent[]
    top: number
    left: number
  } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popover])

  function getEventsForDay(day: Date) {
    return events.filter((e) => isSameDay(e.start, day))
  }

  const openPopover = useCallback((
    e: React.MouseEvent,
    day: Date,
    dayEvents: UnifiedCalendarEvent[]
  ) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    
    // Estimate popover height: header (~50px) + events (~32px each) + footer (~35px) -> max 320px
    const estHeight = Math.min(50 + dayEvents.length * 32 + 35, 320)
    const spaceBelow = window.innerHeight - rect.bottom
    
    // If not enough space below AND there is enough space above, position it above the button
    let top = rect.bottom + window.scrollY + 4
    if (spaceBelow < estHeight && rect.top > estHeight) {
      top = rect.top + window.scrollY - estHeight - 4
    }

    setPopover({
      day,
      dayEvents,
      top,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 260),
    })
  }, [])

  return (
    <div className="flex flex-col h-full select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — explicit row sizing so all weeks always fit */}
      <div
        className="grid grid-cols-7"
        style={{
          flex: 1,
          minHeight: 0,
          gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))`,
        }}
      >
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const MAX_VISIBLE = 2
          const overflow = dayEvents.length - MAX_VISIBLE

          return (
            <div
              key={idx}
              onClick={(e) => {
                onDayClick?.(day)
                openPopover(e, day, dayEvents)
              }}
              className={cn(
                'group relative flex flex-col p-1.5 border-r border-b border-border cursor-pointer transition-colors',
                isCurrentMonth ? 'bg-transparent hover:bg-bg-tertiary/50' : 'bg-bg/30',
                (idx + 1) % 7 === 0 && 'border-r-0',
              )}
            >
              {/* Day number & +N more button row — fixed height */}
              <div className="shrink-0 mb-1 flex items-center justify-between">
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
                
                {overflow > 0 && (
                  <button
                    onClick={(e) => openPopover(e, day, dayEvents)}
                    className="text-[10px] font-medium text-text-muted hover:text-primary transition-colors pr-1"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>

              {/* Event chips — clips if too many, but space is now freed up */}
              <div className="flex-1 overflow-hidden flex flex-col gap-[3px] min-h-0">
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

      {/* ── Floating day popover ─────────────────────────────── */}
      {popover && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-64 bg-bg-tertiary border border-border rounded-xl shadow-2xl overflow-hidden animate-[slideUp_0.15s_ease-out]"
          style={{ top: popover.top, left: popover.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Popover header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary/40">
            <div>
              <p className="text-sm font-semibold text-text">{format(popover.day, 'EEEE')}</p>
              <p className="text-xs text-text-muted">{format(popover.day, 'MMMM d, yyyy')}</p>
            </div>
            <button
              onClick={() => setPopover(null)}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Event list */}
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {popover.dayEvents.map((evt) => (
              <button
                key={evt.id}
                onClick={() => {
                  onEventClick?.(evt)
                  setPopover(null)
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-tertiary transition-colors text-left group/item"
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', DOT[evt.color] ?? 'bg-white/40')} />
                <span className="flex-1 text-sm font-medium text-text-secondary group-hover/item:text-text truncate transition-colors">
                  {evt.title}
                </span>
                {!evt.allDay && (
                  <span className="text-xs text-text-muted shrink-0">
                    {format(evt.start, 'h:mm a')}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* View day link */}
          <div className="px-3 py-2 border-t border-border">
            <button
              onClick={() => {
                if (onViewDay) onViewDay(popover.day)
                else onDayClick?.(popover.day)
                setPopover(null)
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              View day →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
