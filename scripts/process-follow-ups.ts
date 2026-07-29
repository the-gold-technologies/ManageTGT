/**
 * scripts/process-follow-ups.ts
 *
 * Standalone Node.js script for processing due prospect follow-ups.
 * Designed to be executed by Linux cron — NOT the Next.js dev server.
 *
 * Features:
 *   - PID file lock  → prevents concurrent runs if previous job is still running
 *   - Structured logging → all output goes to stdout (captured by the shell wrapper)
 *   - Graceful exit codes → 0 = success, 1 = lock conflict, 2 = unhandled error
 *   - Clean Prisma disconnect → no hanging DB connections
 *
 * Usage:
 *   npx tsx scripts/process-follow-ups.ts
 *
 * Linux crontab (every 15 minutes):
 *   *\/15 * * * * /path/to/agencyos/scripts/run-follow-ups.sh
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { PrismaClient } from '@prisma/client'
import { processDueFollowUps } from '../lib/follow-up-processor'

// ─── Config ───────────────────────────────────────────────────────────────────
const LOCK_FILE = path.join(os.tmpdir(), 'agencyos-follow-ups.lock')
const LOCK_STALE_MS = 10 * 60 * 1000 // 10 minutes — treat lock as stale after this

// ─── Logger ───────────────────────────────────────────────────────────────────
function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string) {
  const ts = new Date().toISOString()
  console.log(`[${ts}] [${level}] ${msg}`)
}

// ─── PID Lock helpers ─────────────────────────────────────────────────────────

function acquireLock(): boolean {
  if (fs.existsSync(LOCK_FILE)) {
    const content = fs.readFileSync(LOCK_FILE, 'utf8').trim()
    const [pidStr, tsStr] = content.split(':')
    const pid = parseInt(pidStr, 10)
    const lockedAt = parseInt(tsStr, 10)

    // Check if the locking process is still running
    const isAlive = (() => {
      try {
        process.kill(pid, 0) // signal 0 = check existence
        return true
      } catch {
        return false // process doesn't exist
      }
    })()

    const isStale = Date.now() - lockedAt > LOCK_STALE_MS

    if (isAlive && !isStale) {
      log('WARN', `Another instance is already running (PID ${pid}). Exiting.`)
      return false
    }

    // Stale lock or dead process — remove and continue
    log('WARN', `Removing stale lock file (PID ${pid}, age ${Math.round((Date.now() - lockedAt) / 1000)}s)`)
    fs.unlinkSync(LOCK_FILE)
  }

  // Write our PID + timestamp to the lock file
  fs.writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`, 'utf8')
  return true
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, 'utf8').trim()
      const pid = parseInt(content.split(':')[0], 10)
      if (pid === process.pid) {
        fs.unlinkSync(LOCK_FILE)
      }
    }
  } catch {
    // Best-effort release
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('INFO', '─── AgencyOS Follow-Up Processor started ───')

  // 1. Acquire lock
  if (!acquireLock()) {
    process.exit(1) // another run in progress
  }

  // Ensure lock is always released
  process.on('exit', releaseLock)
  process.on('SIGINT', () => { releaseLock(); process.exit(0) })
  process.on('SIGTERM', () => { releaseLock(); process.exit(0) })

  const prisma = new PrismaClient({
    log: [], // silence Prisma's own query logs in cron output
  })

  try {
    // 2. Process due follow-ups
    const result = await processDueFollowUps(prisma, {
      log: (msg) => log('INFO', msg),
    })

    if (result.success) {
      log('INFO', `Completed — processed: ${result.processed}, failed: ${result.failed}`)
    } else {
      log('ERROR', `Processor returned failure: ${result.error}`)
      process.exitCode = 2
    }
  } catch (err) {
    log('ERROR', `Unhandled exception: ${err}`)
    process.exitCode = 2
  } finally {
    await prisma.$disconnect()
    releaseLock()
    log('INFO', '─── AgencyOS Follow-Up Processor finished ───')
  }
}

main()
