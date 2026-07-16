'use client'

import { format } from 'date-fns'
import { X, ExternalLink, Calendar, Clock, Tag, Users, AlignLeft } from 'lucide-react'
import type { UnifiedCalendarEvent, CalendarEventColor } from '@/app/actions/calendar'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  task: 'Task Deadline',
  project_start: 'Project Kickoff',
  project_deadline: 'Project Completion',
  project_delivery: 'Project Delivery',
  billing: 'Billing Date',
  invoice_due: 'Invoice Due',
  prospect: 'Proposal Submission',
  meeting: 'Meeting',
  reminder: 'Reminder',
  milestone: 'Milestone',
  leave: 'Leave',
  custom: 'Event',
}

const COLOR_BG: Record<CalendarEventColor, string> = {
  orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  blue:   'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  red:    'from-red-500/20 to-red-500/5 border-red-500/30',
  cyan:   'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
  purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
  green:  'from-green-500/20 to-green-500/5 border-green-500/30',
  amber:  'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  gray:   'from-white/10 to-white/5 border-white/10',
}

const COLOR_BADGE: Record<CalendarEventColor, string> = {
  orange: 'bg-orange-500/20 text-orange-300',
  blue:   'bg-blue-500/20 text-blue-300',
  red:    'bg-red-500/20 text-red-300',
  cyan:   'bg-cyan-500/20 text-cyan-300',
  purple: 'bg-purple-500/20 text-purple-300',
  green:  'bg-green-500/20 text-green-300',
  amber:  'bg-amber-500/20 text-amber-300',
  gray:   'bg-white/10 text-white/60',
}

const SOURCE_LINKS: Record<string, (id: string) => string> = {
  task: (id) => `/my-tasks?task=${id}`,
  project: (id) => `/projects/${id}`,
  invoice: (id) => `/finance/revenue?invoice=${id}`,
  prospect: (id) => `/growth/prospects?prospect=${id}`,
}

interface EventDetailSidebarProps {
  event: UnifiedCalendarEvent | null
  onClose: () => void
  onEdit?: (event: UnifiedCalendarEvent) => void
  onDelete?: (event: UnifiedCalendarEvent) => void
}

export default function EventDetailSidebar({ event, onClose, onEdit, onDelete }: EventDetailSidebarProps) {
  if (!event) return null

  const colorBg = COLOR_BG[event.color] ?? COLOR_BG.gray
  const colorBadge = COLOR_BADGE[event.color] ?? COLOR_BADGE.gray
  const typeLabel = TYPE_LABELS[event.type] ?? 'Event'
  const sourceLink = event.sourceType && event.sourceId ? SOURCE_LINKS[event.sourceType]?.(event.sourceId) : null
  const isCustom = event.id.startsWith('custom-')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn('p-5 rounded-t-xl border bg-gradient-to-b', colorBg)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2', colorBadge)}>
              {typeLabel}
            </span>
            <h3 className="text-base font-semibold text-text leading-tight">{event.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dates */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Calendar size={14} className="shrink-0 text-text-muted" />
            <span>
              {event.allDay
                ? format(event.start, 'EEE, MMMM d, yyyy')
                : format(event.start, 'EEE, MMMM d, yyyy')}
            </span>
          </div>
          {!event.allDay && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Clock size={14} className="shrink-0 text-text-muted" />
              <span>
                {format(event.start, 'h:mm a')}
                {event.end && ` — ${format(event.end, 'h:mm a')}`}
              </span>
            </div>
          )}
          {event.allDay && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Clock size={14} className="shrink-0" />
              <span>All day</span>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="flex gap-2 text-sm text-text-secondary">
            <AlignLeft size={14} className="shrink-0 text-text-muted mt-0.5" />
            <p className="leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* Type badge */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Tag size={14} className="shrink-0 text-text-muted" />
          <span className="capitalize">{event.type.replace(/_/g, ' ')}</span>
        </div>

        {/* Meta */}
        {event.meta && Object.keys(event.meta).length > 0 && (
          <div className="rounded-lg bg-bg-tertiary border border-border p-3 space-y-1.5">
            {Object.entries(event.meta).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null
              return (
                <div key={key} className="flex justify-between text-xs gap-2">
                  <span className="text-text-muted capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-text-secondary font-medium text-right">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Source link */}
        {sourceLink && (
          <a
            href={sourceLink}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink size={14} />
            View source record
          </a>
        )}
      </div>

      {/* Actions (only for custom events) */}
      {isCustom && (onEdit || onDelete) && (
        <div className="p-4 border-t border-border flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="flex-1 h-9 rounded-lg bg-bg-tertiary border border-border text-sm text-text-secondary hover:text-text hover:border-border-muted transition-colors"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event)}
              className="flex-1 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
