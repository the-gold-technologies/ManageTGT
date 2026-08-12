'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'

const SW_PATH = '/sw.js'

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const initialized = useRef(false)
  const timezoneSynced = useRef(false)

  // Quiet hours are stored as plain hours, so the server needs to know which
  // day they belong to. Runs regardless of push support, since quiet hours also
  // gate email.
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (timezoneSynced.current) return
    timezoneSynced.current = true

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timezone) return

    void import('@/app/actions/notifications')
      .then(({ syncUserTimezone }) => syncUserTimezone(timezone))
      .catch(err => console.warn('[PushProvider] timezone sync failed:', err))
  }, [status, session?.user?.id])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (initialized.current) return
    if (!getPushSupport().supported) return

    initialized.current = true
    void initPush()
  }, [status, session?.user?.id])

  async function initPush() {
    try {
      // 1. Register the Service Worker
      const registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: '/',
      })
      console.log('[PushProvider] Service Worker registered:', registration.scope)

      // 2. If permission already granted, ensure subscription is active and sync to DB
      if (Notification.permission === 'granted') {
        await registerToken()
      }

      // Handle messages from the service worker (for in-app toast when notification clicked or received in foreground)
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'PUSH_RECEIVED_FOREGROUND') {
           // We can show a toast here if we want, but Socket.IO already handles foreground updates
           queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      }
      
      navigator.serviceWorker.addEventListener('message', handleMessage)
      return () => { navigator.serviceWorker.removeEventListener('message', handleMessage) }
    } catch (err) {
      console.warn('[PushProvider] Push initialization failed:', err)
    }
  }

  return <>{children}</>
}

// urlBase64ToUint8Array helper function
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Explains why push is unavailable, so mobile users get a real reason instead
// of a silent no-op. iOS only exposes PushManager inside an installed PWA.
export function getPushSupport(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined') return { supported: false, reason: 'Not in a browser' }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  if (!window.isSecureContext) {
    return { supported: false, reason: 'Push requires HTTPS (or localhost)' }
  }
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'This browser has no Service Worker support' }
  }
  if (!('PushManager' in window)) {
    if (isIos && !isStandalone) {
      return { supported: false, reason: 'On iPhone/iPad, tap Share → Add to Home Screen, then enable from the installed app' }
    }
    return { supported: false, reason: 'This browser has no Push API support' }
  }
  if (isIos && !isStandalone) {
    return { supported: false, reason: 'On iPhone/iPad, tap Share → Add to Home Screen, then enable from the installed app' }
  }
  return { supported: true }
}

// Called externally (from settings UI) when user clicks "Enable Notifications"
export async function requestAndRegisterPush(): Promise<{
  success: boolean
  permission: NotificationPermission
  reason?: string
}> {
  const support = getPushSupport()
  if (!support.supported) {
    return { success: false, permission: 'default', reason: support.reason }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, permission }
    }

    const success = await registerToken()
    return { success, permission }
  } catch (err) {
    console.warn('[PushProvider] requestAndRegisterPush error:', err)
    return { success: false, permission: 'denied' }
  }
}

// Compares a live subscription's server key against the current VAPID public key,
// so we only tear down a working subscription when the keys actually changed.
function subscriptionMatchesKey(subscription: PushSubscription, publicVapidKey: string): boolean {
  const existingKey = subscription.options?.applicationServerKey
  if (!existingKey) return false

  const bytes = new Uint8Array(existingKey as ArrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const existingBase64Url = window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return existingBase64Url === publicVapidKey.replace(/=+$/, '')
}

async function registerToken(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready

    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicVapidKey) {
       console.warn('[PushProvider] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing')
       return false
    }

    // Reuse the existing subscription. Re-subscribing on every page load would
    // invalidate the endpoint the server just stored, so only replace it when
    // there is none or the VAPID key it was created with no longer matches.
    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !subscriptionMatchesKey(subscription, publicVapidKey)) {
      console.log('[PushProvider] VAPID key changed — resubscribing')
      await subscription.unsubscribe()
      subscription = null
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      })
    }

    if (!subscription) return false

    // Extract keys
    const subJson = subscription.toJSON()
    if (!subJson.endpoint || !subJson.keys) return false

    // Detect browser/device info
    const ua = navigator.userAgent
    const browserName = ua.includes('Chrome')  ? 'Chrome'
                      : ua.includes('Firefox') ? 'Firefox'
                      : ua.includes('Safari')  ? 'Safari'
                      : ua.includes('Edge')    ? 'Edge'
                      : 'Unknown Browser'

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const deviceType = isMobile ? (ua.includes('Android') ? 'android_pwa' : 'ios_pwa') : 'web'

    // Send subscription to server
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        deviceName: `${browserName} on ${isMobile ? 'Mobile' : 'Desktop'}`,
        deviceType,
        browserName,
      }),
    })

    return res.ok
  } catch (err) {
    console.warn('[PushProvider] registerToken error:', err)
    return false
  }
}
