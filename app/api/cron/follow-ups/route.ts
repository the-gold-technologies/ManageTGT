import { NextRequest, NextResponse } from 'next/server'
import { triggerDueFollowUps } from '@/app/actions/follow-ups'

/**
 * GET /api/cron/follow-ups
 *
 * Processes all pending prospect follow-ups whose scheduled_date has passed.
 * Secured with a shared CRON_SECRET — pass as ?secret=<value> or
 * Authorization: Bearer <value> header.
 *
 * Recommended free cron service: https://cron-job.org (unlimited, free)
 * Set it to call this URL every 15 minutes.
 */
export async function GET(req: NextRequest) {
  // Security check — only allow requests with the correct secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    const querySecret = req.nextUrl.searchParams.get('secret')
    const provided = authHeader?.replace('Bearer ', '') || querySecret

    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await triggerDueFollowUps()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron follow-ups error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
