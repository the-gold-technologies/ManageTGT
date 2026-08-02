'use client'

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { EventDot } from '@/components/calendar/event-chip'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'

export function CalendarWidget({ events = [] }: { events?: UnifiedCalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selected, setSelected] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  
  return (
    <div className="w-full flex flex-col rounded-2xl bg-bg-secondary border border-border overflow-hidden">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-semibold text-text">{format(currentDate, 'MMMM yyyy')}</span>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
              className="p-1 hover:bg-bg-tertiary rounded-md transition-colors text-text-muted hover:text-text"
            >
              <ChevronLeft size={14} />
            </button>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
              className="p-1 hover:bg-bg-tertiary rounded-md transition-colors text-text-muted hover:text-text"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 mb-1">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="flex items-center justify-center h-6 text-[10px] font-semibold text-text-muted uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, currentDate)
            const sel = isSameDay(day, selected)
            const tod = isToday(day)
            
            const dayEvts = events.filter(e => e.start && isSameDay(new Date(e.start), day))

            return (
              <button 
                key={day.toISOString()} 
                onClick={() => { setSelected(day); setCurrentDate(day) }}
                className={cn(
                  'flex flex-col items-center justify-center h-9 gap-0.5 transition-colors',
                  !isCurrentMonth && 'opacity-30',
                )}
              >
                {/* Number chip */}
                <span className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-medium transition-colors',
                  sel && 'bg-primary text-primary-foreground',
                  !sel && tod && 'text-primary font-bold ring-1 ring-primary/40 rounded-md',
                  !sel && !tod && 'text-text hover:bg-bg-tertiary hover:text-text',
                )}>
                  {format(day, 'd')}
                </span>
                
                {/* Event dots row */}
                <div className="flex gap-[3px] h-1.5 items-center justify-center w-full overflow-hidden px-0.5">
                  {dayEvts.length > 0 && !sel && (
                    dayEvts.slice(0, 5).map((e, idx) => (
                      <EventDot key={e.id || idx} color={e.color} />
                    ))
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
