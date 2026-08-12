// Bump SW_VERSION whenever this file changes to force an update.
const SW_VERSION = 'v3'

self.addEventListener('install', function () {
  // Activate this worker immediately instead of waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  // Take control of already-open pages right away.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', function (event) {
  // userVisibleOnly:true means Chrome requires a notification for EVERY push.
  // waitUntil must be called synchronously, so hand it the promise directly.
  event.waitUntil(handlePush(event))
})

async function handlePush(event) {
  let data = {}

  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      // Not JSON — fall back to the raw text so we still surface something.
      try {
        data = { body: event.data.text() }
      } catch (e2) {
        console.error('[ServiceWorker] Could not read push payload', e2)
      }
    }
  }

  // Control message: the notification was read elsewhere, so clear it here.
  // This is why reading a conversation on your laptop clears your phone's lock
  // screen. Note it shows nothing, which spends a little of Chrome's
  // silent-push budget under userVisibleOnly — acceptable for a rare signal.
  if (data.action === 'dismiss') {
    const existing = await self.registration.getNotifications(
      data.tag ? { tag: data.tag } : undefined
    )
    for (const notification of existing) {
      // With no tag, fall back to matching the conversation this came from.
      if (!data.tag && data.entityId && notification.data?.entityId !== data.entityId) continue
      notification.close()
    }
    return
  }

  const title = data.title || 'AgencyOS'

  try {
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      // Collapse duplicates instead of stacking them. A caller-supplied tag
      // groups per conversation, so a chat notification replaces the previous
      // one from that same conversation rather than piling up.
      tag: data.tag || (data.type ? `agencyos-${data.type}` : 'agencyos'),
      renotify: true,
      data: {
        link: data.link || '/',
        type: data.type || 'system_alert',
        entityId: data.entityId || null,
      },
    })
  } catch (err) {
    console.error('[ServiceWorker] showNotification failed', err)
  }

  // Nudge any open tab to refresh its notification list.
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windowClients) {
    client.postMessage({ type: 'PUSH_RECEIVED_FOREGROUND' })
  }
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const link = event.notification.data?.link || '/'
  // Resolve to an absolute URL so it can be compared against client.url.
  const targetUrl = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        // Reuse any open tab on this origin — match on pathname, not the full
        // href, since query strings and hashes should not force a new window.
        if (new URL(client.url).pathname === new URL(targetUrl).pathname && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise focus an existing tab and navigate it, falling back to a new one.
      const existing = windowClients[0]
      if (existing && 'navigate' in existing) {
        return existing.focus().then((c) => c.navigate(targetUrl))
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
