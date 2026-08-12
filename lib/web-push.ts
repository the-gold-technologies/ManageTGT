import webpush from 'web-push'
import prisma from './prisma'

// ─── Initialize web-push ──────────────────────────────────────────────────────

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'mailto:admin@agencyos.app'

if (publicKey && privateKey) {
  webpush.setVapidDetails(contactEmail, publicKey, privateKey)
} else {
  console.warn('[WebPush] VAPID keys missing. Push notifications will not work.')
}

// ─── Send to a single endpoint ───────────────────────────────────────────────

export async function sendWebPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; link?: string; type?: string }
) {
  if (!publicKey || !privateKey) {
    console.warn('[WebPush] Cannot send — VAPID keys missing')
    return { success: false, error: 'VAPID keys missing' }
  }

  try {
    const stringifiedPayload = JSON.stringify(payload)
    await webpush.sendNotification(subscription, stringifiedPayload)
    return { success: true }
  } catch (error: any) {
    console.error('[WebPush] sendNotification error:', error?.message)
    // 410 Gone, 404 Not Found, 403 Forbidden, 401 Unauthorized, or 400 Bad Request
    // means the subscription is no longer valid (e.g. VAPID keys changed)
    if ([410, 404, 403, 401, 400].includes(error.statusCode)) {
      return { success: false, error: 'Subscription expired or invalid', statusCode: error.statusCode }
    }
    return { success: false, error, statusCode: error.statusCode }
  }
}

// ─── Send to a user (all active devices) ──────────────────────────────────────

export async function sendWebPushToUser(
  userId: string,
  payload: { title: string; body: string; link?: string; type?: string }
) {
  if (!publicKey || !privateKey) return { success: false, sentCount: 0 }

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId, isActive: true },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })

    console.log(`[WebPush] Found ${subs.length} active subscriptions for user ${userId}`)

    if (subs.length === 0) return { success: true, sentCount: 0 }

    let sentCount = 0
    const invalidSubIds: string[] = []

    for (const sub of subs) {
      console.log(`[WebPush] Attempting to send to endpoint: ${sub.endpoint.slice(0, 30)}...`)
      const pushSub: webpush.PushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      const result = await sendWebPush(pushSub, payload)
      if (result.success) {
        sentCount++
      } else if (result.statusCode && [410, 404, 403, 401, 400].includes(result.statusCode)) {
        invalidSubIds.push(sub.id)
      }
    }

    // Cleanup expired subscriptions
    if (invalidSubIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: invalidSubIds } },
      })
      console.log(`[WebPush] Cleaned up ${invalidSubIds.length} invalid subscriptions.`)
    }

    return { success: true, sentCount }
  } catch (error) {
    console.error('[WebPush] sendWebPushToUser error:', error)
    return { success: false, sentCount: 0, error }
  }
}

export function isWebPushConfigured(): boolean {
  return Boolean(publicKey && privateKey)
}
