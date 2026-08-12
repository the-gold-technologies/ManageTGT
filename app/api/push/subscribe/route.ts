import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { endpoint, p256dh, auth: authKey, deviceName, deviceType, browserName } = body

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: 'endpoint, p256dh, and auth are required' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { orgId: true },
    })

    // Upsert the subscription
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId:      session.user.id,
        orgId:       dbUser?.orgId || 'default_org_id',
        endpoint,
        p256dh,
        auth: authKey,
        deviceName:  deviceName || null,
        deviceType:  deviceType || 'web',
        browserName: browserName || null,
        isActive:    true,
        lastSeenAt:  new Date(),
      },
      update: {
        userId:      session.user.id,
        p256dh,
        auth: authKey,
        deviceName:  deviceName || undefined,
        deviceType:  deviceType || undefined,
        browserName: browserName || undefined,
        isActive:    true,
        lastSeenAt:  new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push Subscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
