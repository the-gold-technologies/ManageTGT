import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = await req.json()

    if (endpoint) {
      await prisma.pushSubscription.updateMany({
        where: { endpoint, userId: session.user.id },
        data:  { isActive: false },
      })
    } else {
      // Deactivate every device for this user
      await prisma.pushSubscription.updateMany({
        where: { userId: session.user.id },
        data:  { isActive: false },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push Unsubscribe] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
