import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

/**
 * GET /api/google/connect
 * Initiates Google OAuth for credential-based users who want to link their
 * Google account for Google Meet creation.
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const clientId = process.env.AUTH_GOOGLE_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/google/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    // Pass the user's ID in state so the callback knows who to link
    state: session.user.id,
  })

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}
