'use client'

import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent, CalendarEventColor } from '@/app/actions/calendar'
import {
  CheckSquare,
  Rocket,
  Calendar,
  CheckCircle,
  Flag,
  DollarSign,
  Receipt,
  Target,
  Video,
  Bell,
  UserMinus,
} from 'lucide-react'

const COLOR_STYLES: Record<CalendarEventColor, string> = {
  orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  blue:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  red:    'bg-red-500/20 text-red-300 border-red-500/30',
  cyan:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  green:  'bg-green-500/20 text-green-300 border-green-500/30',
  amber:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  gray:   'bg-white/10 text-white/60 border-white/10',
}

const DOT_STYLES: Record<CalendarEventColor, string> = {
  orange: 'bg-orange-400',
  blue:   'bg-blue-400',
  red:    'bg-red-400',
  cyan:   'bg-cyan-400',
  purple: 'bg-purple-400',
  green:  'bg-green-400',
  amber:  'bg-amber-400',
  gray:   'bg-white/40',
}

const TYPE_ICONS: Record<string, any> = {
  task: CheckSquare,
  project_start: Rocket,
  project_deadline: Calendar,
  project_delivery: CheckCircle,
  milestone: Flag,
  billing: DollarSign,
  invoice_due: Receipt,
  prospect: Target,
  meeting: Video,
  reminder: Bell,
  leave: UserMinus,
  custom: Calendar,
}

interface EventChipProps {
  event: UnifiedCalendarEvent
  onClick?: (event: UnifiedCalendarEvent) => void
  compact?: boolean
}

export function EventChip({ event, onClick, compact = false }: EventChipProps) {
  const colorClass = COLOR_STYLES[event.color] ?? COLOR_STYLES.gray
  const IconComponent = TYPE_ICONS[event.type] ?? Calendar

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(event) }}
      className={cn(
        'w-full text-left truncate rounded border px-1.5 transition-opacity hover:opacity-80 cursor-pointer',
        compact ? 'py-0 text-[10px] leading-5' : 'py-0.5 text-xs',
        colorClass
      )}
      title={event.title}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <IconComponent className={cn('shrink-0 opacity-80', compact ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
        <span className="truncate font-medium">{event.title}</span>
      </span>
    </button>
  )
}

/** A colored dot used in mini calendar / week header */
export function EventDot({ color }: { color: CalendarEventColor }) {
  return (
    <span className={cn('inline-block w-1.5 h-1.5 rounded-full', DOT_STYLES[color])} />
  )
}
