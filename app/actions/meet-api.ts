'use server'

import { google } from 'googleapis'
import prisma from '@/lib/prisma'

/**
 * Creates a Zoom Meeting using Server-to-Server OAuth
 * Requires ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in .env
 */
export async function createZoomMeeting(topic: string, startTime: string | Date, durationMinutes: number = 60) {
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    console.warn('Zoom credentials not found in .env. Falling back to mock URL.')
    return { join_url: `https://zoom.us/j/mock${Date.now()}`, id: `mock-${Date.now()}` }
  }

  try {
    // 1. Get Access Token
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenResponse = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
      },
      cache: 'no-store'
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Zoom access token')
    }

    const { access_token } = await tokenResponse.json()

    // 2. Create Meeting
    const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        type: 2, // Scheduled meeting
        start_time: new Date(startTime).toISOString(),
        duration: durationMinutes,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          jbh_time: 0,
          mute_upon_entry: true,
          waiting_room: false  // Must be false for join_before_host to take effect
        }
      })
    })

    if (!meetingResponse.ok) {
      const errorText = await meetingResponse.text()
      console.error('Zoom API Error:', errorText)
      throw new Error('Failed to create Zoom meeting')
    }

    const data = await meetingResponse.json()
    return {
      join_url: data.join_url,
      id: String(data.id)
    }
  } catch (error) {
    console.error('Error creating Zoom meeting:', error)
    throw error
  }
}

/**
 * Creates a Google Meet link using the REQUESTING USER'S own OAuth tokens.
 *
 * Resolution order:
 *  1. userId provided → look up Account row in DB → use their refresh_token (user is host ✓)
 *  2. Fallback to GOOGLE_REFRESH_TOKEN env var (admin token — admin is host)
 *  3. Neither available → return null (caller should surface a "Connect Google" prompt)
 *
 * @param topic          - Meeting title / event summary
 * @param startTime      - ISO string or Date of meeting start
 * @param endTime        - ISO string or Date of meeting end
 * @param attendeeEmails - List of attendee email addresses
 * @param userId         - The AgencyOS user ID of the person creating the meeting
 */
export async function syncGoogleCalendarEvent(
  topic: string,
  startTime: string | Date,
  endTime: string | Date,
  attendeeEmails: string[] = [],
  userId?: string,
  generateMeetLink: boolean = true
): Promise<{ join_url: string | null; id: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET

  if (!clientId || !clientSecret) {
    console.warn('Google OAuth app credentials not configured.')
    return null
  }

  // ── Resolve tokens: per-user first, admin fallback ──────────────
  let refreshToken: string | null = null

  if (userId) {
    const account = await prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { refresh_token: true },
    })
    refreshToken = account?.refresh_token ?? null
  }

  // Fallback to shared admin token from .env (admin will be the host)
  if (!refreshToken) {
    refreshToken = process.env.GOOGLE_REFRESH_TOKEN ?? null
  }

  if (!refreshToken) {
    console.warn('No Google refresh token available for userId=%s. User must connect Google.', userId)
    return null
  }

  // ── Create the calendar event with a Meet conference link ────────
  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const validEmails = attendeeEmails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))

    const event: any = {
      summary: topic,
      start: { dateTime: new Date(startTime).toISOString() },
      end: { dateTime: new Date(endTime).toISOString() },
      attendees: validEmails.length > 0 ? validEmails.map(email => ({ email })) : undefined,
    }

    if (generateMeetLink) {
      event.conferenceData = {
        createRequest: {
          requestId: `agencyos-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: generateMeetLink ? 1 : 0,
      sendUpdates: 'none', // We send our own emails via nodemailer
      requestBody: event,
    })

    if (generateMeetLink && !response.data.hangoutLink) {
      console.warn('Google Meet link was requested but not generated by Google Calendar API')
    }

    return {
      join_url: response.data.hangoutLink || null,
      id: response.data.id || `evt-${Date.now()}`
    }
  } catch (error) {
    console.error('Error syncing event to Google Calendar:', error)
    throw error
  }
}
