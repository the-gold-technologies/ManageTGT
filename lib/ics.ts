/**
 * Minimal RFC 5545 (iCalendar) generator — no external dependencies.
 * Produces a valid .ics string from an array of calendar events.
 */

export interface ICSEvent {
  uid: string
  summary: string
  description?: string
  dtStart: Date
  dtEnd?: Date
  allDay?: boolean
  url?: string
  categories?: string[]
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

/** Escape special chars per RFC 5545 §3.3.11 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Format a Date as YYYYMMDDTHHmmssZ (UTC) */
function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Format a Date as YYYYMMDD for all-day events */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let pos = 0
  while (pos < line.length) {
    parts.push(line.slice(pos, pos + 75))
    pos += 75
  }
  return parts.join('\r\n ')
}

/**
 * Generate a complete .ics calendar feed from events.
 * @param events  Array of ICSEvent objects
 * @param calName Calendar display name shown in client apps
 */
export function generateICS(events: ICSEvent[], calName = 'AgencyOS Calendar'): string {
  const now = formatDateTime(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//AgencyOS//Calendar//EN`,
    `X-WR-CALNAME:${escapeText(calName)}`,
    'X-WR-TIMEZONE:UTC',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const evt of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${evt.uid}@agencyos`)
    lines.push(`DTSTAMP:${now}`)

    if (evt.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(evt.dtStart)}`)
      if (evt.dtEnd) {
        // All-day end is exclusive in ICS — add 1 day
        const end = new Date(evt.dtEnd)
        end.setDate(end.getDate() + 1)
        lines.push(`DTEND;VALUE=DATE:${formatDate(end)}`)
      }
    } else {
      lines.push(`DTSTART:${formatDateTime(evt.dtStart)}`)
      if (evt.dtEnd) {
        lines.push(`DTEND:${formatDateTime(evt.dtEnd)}`)
      } else {
        // Default 1-hour duration
        const end = new Date(evt.dtStart.getTime() + 60 * 60 * 1000)
        lines.push(`DTEND:${formatDateTime(end)}`)
      }
    }

    lines.push(`SUMMARY:${escapeText(evt.summary)}`)

    if (evt.description) {
      lines.push(`DESCRIPTION:${escapeText(evt.description)}`)
    }

    if (evt.url) {
      lines.push(`URL:${evt.url}`)
    }

    if (evt.categories?.length) {
      lines.push(`CATEGORIES:${evt.categories.map(escapeText).join(',')}`)
    }

    lines.push(`STATUS:${evt.status ?? 'CONFIRMED'}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}
