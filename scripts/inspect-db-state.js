/**
 * scripts/inspect-db-state.js
 *
 * READ-ONLY. Reports migration history and whether the notification-system
 * objects exist, so you can compare two databases before deploying.
 *
 * Local:  node scripts/inspect-db-state.js
 * Prod:   DATABASE_URL="postgresql://..." node scripts/inspect-db-state.js
 *
 * Issues no writes, takes no locks, and creates nothing.
 */
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const { Client } = require('pg')

const EXPECTED_TABLES = ['Notification', 'NotificationPreference', 'PushSubscription']
const EXPECTED_NOTIFICATION_COLS = ['readAt', 'priority', 'entityType', 'entityId', 'channels']

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL (or DIRECT_URL)')

  const host = (() => { try { return new URL(url).host } catch { return 'unparseable' } })()
  console.log(`Database: ${host}\n`)

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    // ─── Migration history ──────────────────────────────────────────────────
    const hasMigTable = await client.query(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`
    )

    if (!hasMigTable.rows[0].present) {
      console.log('_prisma_migrations: MISSING — this database has never been migrated.')
    } else {
      const migs = await client.query(
        `SELECT migration_name, finished_at, rolled_back_at
           FROM _prisma_migrations ORDER BY migration_name`
      )
      console.log(`_prisma_migrations (${migs.rows.length} rows):`)
      for (const m of migs.rows) {
        const flags = []
        if (!m.finished_at) flags.push('UNFINISHED — blocks migrate deploy (P3009)')
        if (m.rolled_back_at) flags.push('ROLLED BACK')
        console.log(`   ${m.migration_name}${flags.length ? '  <-- ' + flags.join(', ') : ''}`)
      }
    }

    // ─── Tables ─────────────────────────────────────────────────────────────
    console.log('\nNotification-system tables:')
    for (const t of EXPECTED_TABLES) {
      const r = await client.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [`public."${t}"`])
      console.log(`   ${r.rows[0].present ? '✓' : '✗ MISSING'}  ${t}`)
    }

    // ─── Notification columns ───────────────────────────────────────────────
    const notifExists = await client.query(
      `SELECT to_regclass('public."Notification"') IS NOT NULL AS present`
    )
    if (notifExists.rows[0].present) {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name='Notification'`
      )
      const have = new Set(cols.rows.map((c) => c.column_name))
      console.log('\nNotification columns added by the new engine:')
      for (const c of EXPECTED_NOTIFICATION_COLS) {
        console.log(`   ${have.has(c) ? '✓' : '✗ MISSING'}  ${c}`)
      }
    }

    // ─── Row counts, where the tables exist ─────────────────────────────────
    console.log('\nRow counts:')
    for (const t of EXPECTED_TABLES) {
      const r = await client.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [`public."${t}"`])
      if (!r.rows[0].present) { console.log(`   ${t}: n/a`); continue }
      const c = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`)
      console.log(`   ${t}: ${c.rows[0].c}`)
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => { console.error('Inspect failed:', err.message); process.exitCode = 1 })
