'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Calendar, Clock, AlignLeft, Tag } from 'lucide-react'
import { createCalendarEvent, updateCalendarEvent } from '@/app/actions/calendar'
import type { UnifiedCalendarEvent } from '@/app/actions/calendar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const EVENT_TYPES = [
  { value: 'meeting',   label: 'Meeting',   color: 'text-cyan-400' },
  { value: 'reminder',  label: 'Reminder',  color: 'text-green-400' },
  { value: 'milestone', label: 'Milestone', color: 'text-blue-400' },
  { value: 'leave',     label: 'Leave',     color: 'text-purple-400' },
  { value: 'custom',    label: 'Custom',    color: 'text-white/60' },
]

const COLOR_OPTIONS = [
  { value: 'cyan',   label: 'Cyan',   cls: 'bg-cyan-400' },
  { value: 'green',  label: 'Green',  cls: 'bg-green-400' },
  { value: 'blue',   label: 'Blue',   cls: 'bg-blue-400' },
  { value: 'purple', label: 'Purple', cls: 'bg-purple-400' },
  { value: 'orange', label: 'Orange', cls: 'bg-orange-400' },
  { value: 'amber',  label: 'Amber',  cls: 'bg-amber-400' },
  { value: 'red',    label: 'Red',    cls: 'bg-red-400' },
  { value: 'gray',   label: 'Gray',   cls: 'bg-white/40' },
]

interface CalendarEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editEvent?: UnifiedCalendarEvent | null
  defaultDate?: Date | null
}

export default function CalendarEventModal({
  isOpen,
  onClose,
  onSuccess,
  editEvent,
  defaultDate,
}: CalendarEventModalProps) {
  const isEdit = !!editEvent

  const [type, setType] = useState('meeting')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [color, setColor] = useState('cyan')
  const [saving, setSaving] = useState(false)

  // Populate fields when editing
  useEffect(() => {
    if (isEdit && editEvent) {
      const sourceId = editEvent.id.replace('custom-', '')
      setType(editEvent.type)
      setTitle(editEvent.title)
      setDescription(editEvent.description ?? '')
      setStartDate(format(editEvent.start, 'yyyy-MM-dd'))
      setStartTime(editEvent.allDay ? '' : format(editEvent.start, 'HH:mm'))
      setEndDate(editEvent.end ? format(editEvent.end, 'yyyy-MM-dd') : '')
      setEndTime(editEvent.end && !editEvent.allDay ? format(editEvent.end, 'HH:mm') : '')
      setAllDay(editEvent.allDay)
      setColor(editEvent.color)
    } else {
      // Reset for create
      setType('meeting')
      setTitle('')
      setDescription('')
      setStartDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
      setStartTime('')
      setEndDate('')
      setEndTime('')
      setAllDay(true)
      setColor('cyan')
    }
  }, [isEdit, editEvent, defaultDate, isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startDate) return

    setSaving(true)
    try {
      const startIso = allDay
        ? new Date(startDate + 'T00:00:00').toISOString()
        : new Date(`${startDate}T${startTime || '00:00'}`).toISOString()
      const endIso = endDate
        ? (allDay
            ? new Date(endDate + 'T23:59:59').toISOString()
            : new Date(`${endDate}T${endTime || '23:59'}`).toISOString())
        : undefined

      if (isEdit) {
        const sourceId = editEvent!.id.replace('custom-', '')
        const result = await updateCalendarEvent(sourceId, {
          type, title: title.trim(), description: description.trim() || undefined,
          start_date: startIso, end_date: endIso, all_day: allDay, color,
        })
        if (result.success) { toast.success('Event updated'); onSuccess(); onClose() }
        else toast.error(result.error ?? 'Failed to update')
      } else {
        const result = await createCalendarEvent({
          type, title: title.trim(), description: description.trim() || undefined,
          start_date: startIso, end_date: endIso, all_day: allDay, color,
        })
        if (result.success) { toast.success('Event created'); onSuccess(); onClose() }
        else toast.error(result.error ?? 'Failed to create')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Event type */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Type
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                    type === t.value
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-bg-tertiary border-border text-text-muted hover:text-text'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 block">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title..."
              required
              className="w-full h-10 rounded-lg bg-bg-tertiary border border-border px-3 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <AlignLeft size={12} /> Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
              className="w-full rounded-lg bg-bg-tertiary border border-border px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAllDay(!allDay)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                allDay ? 'bg-primary' : 'bg-bg-tertiary border border-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  allDay ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
            <span className="text-sm text-text-secondary">All day</span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full h-10 rounded-lg bg-bg-tertiary border border-border px-3 text-sm text-text focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full h-10 rounded-lg bg-bg-tertiary border border-border px-3 text-sm text-text focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Clock size={11} /> Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full h-10 rounded-lg bg-bg-tertiary border border-border px-3 text-sm text-text focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Clock size={11} /> End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full h-10 rounded-lg bg-bg-tertiary border border-border px-3 text-sm text-text focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Color picker */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-all',
                    c.cls,
                    color === c.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary scale-110'
                      : 'opacity-60 hover:opacity-100'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg bg-bg-tertiary border border-border text-sm text-text-secondary hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
