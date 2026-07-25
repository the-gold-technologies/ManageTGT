'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'

/**
 * Returns whether the current (or given) user has a Google Account linked
 * with calendar scope tokens stored in the Account table.
 */
export async function getGoogleConnectionStatus(userId?: string): Promise<boolean> {
  const resolvedId = userId ?? (await auth())?.user?.id
  if (!resolvedId) return false

  const account = await prisma.account.findFirst({
    where: {
      userId: resolvedId,
      provider: 'google',
    },
    select: { refresh_token: true },
  })

  // Linked if we have a refresh token (calendar-scoped access)
  return !!(account?.refresh_token)
}

/**
 * Returns the Google Account record for a user (used internally by meet-api).
 * Returns null if none found.
 */
export async function getUserGoogleAccount(userId: string) {
  return prisma.account.findFirst({
    where: {
      userId,
      provider: 'google',
    },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  })
}
