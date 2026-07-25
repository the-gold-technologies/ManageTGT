'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Calendar, Clock, AlignLeft, Tag, Users, Video, ChevronDown } from 'lucide-react'
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
  googleConnected?: boolean
}

export default function CalendarEventModal({
  isOpen,
  onClose,
  onSuccess,
  editEvent,
  defaultDate,
  googleConnected = true,
}: CalendarEventModalProps) {
  const isEdit = !!editEvent

  const [type, setType] = useState('meeting')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [color, setColor] = useState('cyan')
  const [saving, setSaving] = useState(false)
  const [attendeeEmails, setAttendeeEmails] = useState('')
  const [guestInput, setGuestInput] = useState('')
  const [meetingPlatform, setMeetingPlatform] = useState<string | null>(null)
  
  const [typeOpen, setTypeOpen] = useState(false)
  const [platformOpen, setPlatformOpen] = useState(false)

  const handleGuestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      const newEmail = guestInput.trim()
      if (newEmail) {
        const current = attendeeEmails.split(',').map(e => e.trim()).filter(Boolean)
        if (!current.includes(newEmail)) {
          setAttendeeEmails([...current, newEmail].join(', '))
        }
        setGuestInput('')
      }
    } else if (e.key === 'Backspace' && !guestInput) {
      const current = attendeeEmails.split(',').map(e => e.trim()).filter(Boolean)
      current.pop()
      setAttendeeEmails(current.join(', '))
    }
  }

  const removeGuest = (emailToRemove: string) => {
    const current = attendeeEmails.split(',').map(e => e.trim()).filter(Boolean)
    setAttendeeEmails(current.filter(e => e !== emailToRemove).join(', '))
  }

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
      setAttendeeEmails(editEvent.attendee_emails?.join(', ') ?? '')
      setMeetingPlatform(editEvent.meeting_platform ?? null)
    } else {
      // Reset for create
      setType('meeting')
      setTitle('')
      setDescription('')
      setStartDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
      setStartTime('')
      setEndDate('')
      setEndTime('')
      setAllDay(false)
      setColor('cyan')
      setAttendeeEmails('')
      setGuestInput('')
      setMeetingPlatform(null)
      setTypeOpen(false)
      setPlatformOpen(false)
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

        const emails = attendeeEmails.split(',').map(e => e.trim()).filter(Boolean)
        
        if (isEdit) {
          const sourceId = editEvent!.id.replace('custom-', '')
          const result = await updateCalendarEvent(sourceId, {
            type, title: title.trim(), description: description.trim() || undefined,
            start_date: startIso, end_date: endIso, all_day: allDay, color,
            attendee_emails: emails,
            meeting_platform: type === 'meeting' ? meetingPlatform : null,
          })
          if (result.success) { toast.success('Event updated'); onSuccess(); onClose() }
          else toast.error(result.error ?? 'Failed to update')
        } else {
          const result = await createCalendarEvent({
            type, title: title.trim(), description: description.trim() || undefined,
            start_date: startIso, end_date: endIso, all_day: allDay, color,
            attendee_emails: emails,
            meeting_platform: type === 'meeting' ? meetingPlatform : null,
          })
          if (result.success) { toast.success('Event created'); onSuccess(); onClose() }
          else if (result.error === 'google_not_connected') {
            toast.error('Connect your Google account to create Google Meet links', {
              action: {
                label: 'Connect Google',
                onClick: () => { window.location.href = '/api/google/connect' },
              },
              duration: 8000,
            })
          } else toast.error(result.error ?? 'Failed to create')
        }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[500px] max-h-[96vh] flex flex-col bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease-out]">
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Header area - Type & Color */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0 z-10 relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setTypeOpen(!typeOpen)}
                  onBlur={() => setTimeout(() => setTypeOpen(false), 200)}
                  className="flex items-center gap-2 bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm font-medium text-text focus:outline-none focus:border-border focus:bg-bg-tertiary/80 cursor-pointer"
                >
                  {EVENT_TYPES.find(t => t.value === type)?.label}
                  <ChevronDown size={14} className="text-text-muted" />
                </button>
                {typeOpen && (
                  <div className="absolute left-0 top-full mt-1 w-36 bg-bg-tertiary border border-white/10 rounded-lg shadow-2xl drop-shadow-xl z-50 overflow-hidden animate-[fadeIn_0.1s_ease-out] py-1">
                    {EVENT_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setType(t.value); setTypeOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors",
                          type === t.value ? "text-text font-medium bg-bg-secondary/50" : "text-text-secondary"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1.5 bg-bg-tertiary border border-border rounded-md px-2 py-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.value)}
                    className={cn(
                      'w-4 h-4 rounded-full transition-all',
                      c.cls,
                      color === c.value ? 'ring-2 ring-white ring-offset-1 ring-offset-bg-tertiary scale-110' : 'opacity-40 hover:opacity-100 hover:scale-110'
                    )}
                  />
                ))}
              </div>
            </div>
            
            <button type="button" onClick={onClose} className="p-1.5 text-text-muted hover:text-text hover:bg-bg-tertiary rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 space-y-5 mt-2 flex-1 overflow-y-auto pb-4">
            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event Title"
                required
                className="w-full bg-transparent text-2xl font-semibold text-text placeholder-text-muted/40 focus:outline-none border-b border-transparent focus:border-border transition-colors pb-2"
                autoFocus
              />
            </div>

            {/* Date & Time block */}
            <div className="bg-bg-tertiary rounded-xl p-4 space-y-4 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <Calendar size={16} />
                  <span>Date & Time</span>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer text-text-secondary hover:text-text transition-colors">
                  <input 
                    type="checkbox" 
                    checked={allDay} 
                    onChange={e => setAllDay(e.target.checked)} 
                    className="w-4 h-4 rounded border-border bg-bg-tertiary text-primary focus:ring-primary/50 cursor-pointer" 
                  />
                  All day
                </label>
              </div>
              
              <div className="flex flex-col gap-3 mt-1">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm text-text-muted w-10 shrink-0">Start</span>
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      required 
                      className="flex-1 min-w-[130px] bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border focus:bg-bg-tertiary/80" 
                    />
                    {!allDay && (
                      <input 
                        type="time" 
                        value={startTime} 
                        onChange={e => setStartTime(e.target.value)} 
                        className="w-[130px] bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border focus:bg-bg-tertiary/80" 
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm text-text-muted w-10 shrink-0">End</span>
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)} 
                      min={startDate} 
                      className="flex-1 min-w-[130px] bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border focus:bg-bg-tertiary/80" 
                    />
                    {!allDay && (
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={e => setEndTime(e.target.value)} 
                        className="w-[130px] bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border focus:bg-bg-tertiary/80" 
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Meeting details */}
            {type === 'meeting' && (
              <div className="bg-bg-tertiary rounded-xl p-4 space-y-4 border border-border animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <Video size={16} />
                  <span>Meeting Details</span>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <button 
                      type="button"
                      onClick={() => setPlatformOpen(!platformOpen)}
                      onBlur={() => setTimeout(() => setPlatformOpen(false), 200)}
                      className="w-full flex items-center justify-between bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border focus:bg-bg-tertiary/80 cursor-pointer min-h-[38px]"
                    >
                      <span>
                        {meetingPlatform === 'google_meet' ? 'Google Meet' : 
                         meetingPlatform === 'zoom' ? 'Zoom' : 'No Conferencing'}
                      </span>
                      <ChevronDown size={14} className="text-text-muted" />
                    </button>
                    {platformOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-bg-tertiary border border-white/10 rounded-lg shadow-2xl drop-shadow-xl z-50 overflow-hidden animate-[fadeIn_0.1s_ease-out] py-1">
                        <button type="button" onClick={() => { setMeetingPlatform(null); setPlatformOpen(false); }} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors", meetingPlatform === null ? "text-text font-medium bg-bg-secondary/50" : "text-text-secondary")}>No Conferencing</button>
                        <button type="button" onClick={() => { setMeetingPlatform('google_meet'); setPlatformOpen(false); }} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors", meetingPlatform === 'google_meet' ? "text-text font-medium bg-bg-secondary/50" : "text-text-secondary")}>Google Meet</button>
                        <button type="button" onClick={() => { setMeetingPlatform('zoom'); setPlatformOpen(false); }} className={cn("w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors", meetingPlatform === 'zoom' ? "text-text font-medium bg-bg-secondary/50" : "text-text-secondary")}>Zoom</button>
                      </div>
                    )}
                  </div>

                  <div 
                    className="relative flex flex-wrap items-center gap-1.5 w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-2 py-1.5 text-sm text-text focus-within:border-border focus-within:bg-bg-tertiary/80 transition-colors cursor-text min-h-[38px] max-h-[88px] overflow-y-auto"
                  >
                    <Users size={14} className="absolute left-3 top-2.5 text-text-muted" />
                    
                    {attendeeEmails.split(',').map(e => e.trim()).filter(Boolean).map((email, i) => (
                      <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-bg-tertiary rounded text-xs border border-border/50 text-text-secondary max-w-full">
                        <span className="truncate max-w-[140px]">{email}</span>
                        <button type="button" onClick={() => removeGuest(email)} className="text-text-muted hover:text-danger focus:outline-none shrink-0">
                          <X size={12}/>
                        </button>
                      </span>
                    ))}
                    
                    <input
                      type="text"
                      value={guestInput}
                      onChange={e => setGuestInput(e.target.value)}
                      onKeyDown={handleGuestKeyDown}
                      onBlur={() => {
                        const newEmail = guestInput.trim()
                        if (newEmail) {
                          const current = attendeeEmails.split(',').map(e => e.trim()).filter(Boolean)
                          if (!current.includes(newEmail)) {
                            setAttendeeEmails([...current, newEmail].join(', '))
                          }
                          setGuestInput('')
                        }
                      }}
                      placeholder={attendeeEmails ? "Add more..." : "Guests (type & press Enter)"}
                      className="flex-1 min-w-[120px] bg-transparent focus:outline-none placeholder-text-muted py-0.5"
                    />
                  </div>
                </div>

                {/* Google not connected notice */}
                {meetingPlatform === 'google_meet' && !googleConnected && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 animate-[fadeIn_0.2s_ease-out]">
                    <div className="shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-secondary leading-snug">
                        <span className="font-medium text-text">Google not connected.</span>{' '}
                        Connect to become the meeting host.
                      </p>
                    </div>
                    <a
                      href="/api/google/connect"
                      className="shrink-0 h-6 px-2.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors flex items-center"
                    >
                      Connect
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className="flex items-start gap-3">
              <AlignLeft size={16} className="mt-3 text-text-secondary" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
                rows={3}
                className="w-full bg-bg-tertiary/30 border border-border focus:bg-bg-tertiary/60 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-border shrink-0 bg-bg-tertiary/20">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text hover:bg-bg-tertiary transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || !title.trim()} 
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              {saving ? 'Saving...' : `Save ${EVENT_TYPES.find(t => t.value === type)?.label || 'Event'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
