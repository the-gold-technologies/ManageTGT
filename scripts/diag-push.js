/**
 * scripts/diag-push.js
 *
 * End-to-end web-push diagnostic. Verifies VAPID config, the stored
 * subscriptions, and whether the push service actually accepts a message.
 *
 *   node scripts/diag-push.js          # inspect only
 *   node scripts/diag-push.js --send   # also send a real push to every device
 */
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const crypto = require('crypto')
const webpush = require('web-push')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const shouldSend = process.argv.includes('--send')

async function main() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'mailto:admin@agencyos.app'

  console.log('── VAPID config ─────────────────────────────')
  console.log('  public key :', pub ? `set (${pub.length} chars)` : 'MISSING')
  console.log('  private key:', priv ? `set (${priv.length} chars)` : 'MISSING')
  console.log('  contact    :', contact)

  if (!pub || !priv) {
    console.log('\n  ✗ VAPID keys missing — push can never be sent.')
    return
  }

  // The public key must be derivable from the private key, otherwise every
  // send is rejected with 401/403 by the push service.
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.setPrivateKey(Buffer.from(priv, 'base64url'))
  const derived = ecdh.getPublicKey().toString('base64url')
  const keypairOk = derived === pub.replace(/=+$/, '')
  console.log('  keypair    :', keypairOk ? '✓ matches' : '✗ MISMATCH — regenerate both keys')

  if (!contact.startsWith('mailto:') && !contact.startsWith('http')) {
    console.log('  ✗ contact must be a mailto: or https: URL, or web-push throws on init.')
    return
  }

  webpush.setVapidDetails(contact, pub, priv)

  const subs = await prisma.pushSubscription.findMany({ orderBy: { createdAt: 'desc' } })
  console.log(`\n── Subscriptions (${subs.length}) ──────────────────────`)
  for (const s of subs) {
    let host = 'INVALID URL'
    try { host = new URL(s.endpoint).host } catch { /* keep placeholder */ }
    console.log(
      `  ${s.isActive ? '✓ active  ' : '· inactive'} ${s.deviceName || 'Unknown'}` +
      ` | ${host} | keys ${s.p256dh?.length}/${s.auth?.length}` +
      ` | ${s.createdAt.toISOString()}`
    )
  }

  const active = subs.filter((s) => s.isActive)
  if (active.length === 0) {
    console.log('\n  ✗ No active subscriptions. Open Settings → Notifications → Enable.')
    return
  }

  if (!shouldSend) {
    console.log('\n  Re-run with --send to push a real test notification.')
    return
  }

  console.log('\n── Sending ──────────────────────────────────')
  for (const s of active) {
    try {
      const res = await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: 'Push diagnostic',
          body: 'If you can see this, web push is working.',
          link: '/settings',
          type: 'system_alert',
        })
      )
      console.log(`  ✓ ${s.deviceName || 'device'} → accepted (${res.statusCode})`)
    } catch (err) {
      console.log(`  ✗ ${s.deviceName || 'device'} → ${err.statusCode} ${err.body || err.message}`)
      if ([404, 410].includes(err.statusCode)) {
        console.log('    Subscription is gone — the browser must re-subscribe.')
      }
      if ([401, 403].includes(err.statusCode)) {
        console.log('    VAPID keys rejected — they no longer match this subscription.')
      }
    }
  }
  console.log(
    '\n  A 201/accepted here means the push service took the message.\n' +
    '  If nothing appears on screen, the problem is browser/OS-side:\n' +
    '   • Windows Settings → System → Notifications → Google Chrome must be On\n' +
    '   • Turn off Focus assist / Do not disturb\n' +
    '   • Chrome must be running (chrome://settings/system → keep background apps)\n' +
    '   • Check chrome://serviceworker-internals for an activated /sw.js'
  )
}

main()
  .catch((err) => { console.error('Diagnostic failed:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
