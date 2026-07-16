import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { exportICS } from '@/app/actions/calendar'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const icsContent = await exportICS()

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="agencyos-calendar.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
