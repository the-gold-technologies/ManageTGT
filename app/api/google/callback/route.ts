import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/google/callback
 * Handles the OAuth redirect from Google.
 * Exchanges auth code for tokens and upserts the Account row for the user.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const calendarUrl = `${appUrl}/calendar`

  // Handle user denial
  if (error) {
    return NextResponse.redirect(`${calendarUrl}?google_connect=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${calendarUrl}?google_connect=error`)
  }

  const clientId = process.env.AUTH_GOOGLE_ID
  const clientSecret = process.env.AUTH_GOOGLE_SECRET
  const redirectUri = `${appUrl}/api/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${calendarUrl}?google_connect=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${calendarUrl}?google_connect=error`)
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token, expires_in, scope, token_type, id_token } = tokens

    // Decode the sub (providerAccountId) from the id_token
    let providerAccountId = `google-linked-${state}`
    if (id_token) {
      try {
        const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString())
        providerAccountId = payload.sub || providerAccountId
      } catch {
        // fallback
      }
    }

    const expiresAt = expires_in ? Math.floor(Date.now() / 1000) + Number(expires_in) : undefined

    // Upsert the Account row — link Google to this user
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId,
        },
      },
      create: {
        userId: state,
        type: 'oauth',
        provider: 'google',
        providerAccountId,
        access_token,
        refresh_token: refresh_token ?? null,
        expires_at: expiresAt ?? null,
        token_type: token_type ?? 'Bearer',
        scope: scope ?? null,
        id_token: id_token ?? null,
      },
      update: {
        userId: state, // ensure linked to correct user
        access_token,
        // Only overwrite refresh_token if we received a new one (Google only returns it on first consent)
        ...(refresh_token ? { refresh_token } : {}),
        expires_at: expiresAt ?? null,
        scope: scope ?? null,
        id_token: id_token ?? null,
      },
    })

    return NextResponse.redirect(`${calendarUrl}?google_connect=success`)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${calendarUrl}?google_connect=error`)
  }
}
