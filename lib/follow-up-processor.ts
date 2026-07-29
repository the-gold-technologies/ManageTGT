/**
 * lib/follow-up-processor.ts
 *
 * Pure follow-up processing logic — no Next.js dependencies.
 * Importable from:
 *   - Next.js server actions (app/actions/follow-ups.ts)
 *   - Standalone Node.js cron scripts (scripts/process-follow-ups.ts)
 */

import { sendFollowUpEmail } from './email'

// Duck-typed interface — only the model methods this processor actually uses.
// Compatible with both the global prisma singleton and `new PrismaClient()`.
interface PrismaLike {
  prospectFollowUp: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<any[]>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<any>
  }
  user: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args: any) => Promise<any[]>
  }
  roleModuleAccess: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<any | null>
  }
  notification: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createMany: (args: any) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<any | null>
  }
}

// Accept an external Prisma instance so the caller controls the connection lifecycle
export async function processDueFollowUps(
  prisma: PrismaLike,
  opts: { orgId?: string; log?: (msg: string) => void } = {}
): Promise<{ success: boolean; processed: number; failed: number; error?: string }> {
  const log = opts.log ?? console.log
  const now = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    status: 'pending',
    scheduled_date: { lte: now },
  }
  if (opts.orgId) where.orgId = opts.orgId

  log(`[follow-up-processor] Checking for due follow-ups at ${now.toISOString()}`)

  const due = await prisma.prospectFollowUp.findMany({
    where,
    include: {
      prospect: {
        select: {
          id: true,
          name: true,
          email: true,
          proposal_submission_date: true,
          orgId: true,
        },
      },
    },
  })

  log(`[follow-up-processor] Found ${due.length} due follow-up(s)`)

  if (due.length === 0) return { success: true, processed: 0, failed: 0 }

  const results = await Promise.allSettled(
    due.map(async (fu) => {
      const prospect = fu.prospect

      // ── 1. Send email to the prospect if channel is email ──────────────────
      let emailOk = true
      if (fu.channel === 'email') {
        log(`[follow-up-processor] Sending email to ${prospect.email} for prospect "${prospect.name}"`)
        const result = await sendFollowUpEmail({
          toEmail: prospect.email,
          prospectName: prospect.name,
          proposalDate: prospect.proposal_submission_date?.toISOString(),
          customNote: fu.note ?? undefined,
        })
        emailOk = result?.success ?? false
        log(`[follow-up-processor] Email to ${prospect.email}: ${emailOk ? 'OK' : 'FAILED'}`)
      }

      // ── 2. Resolve which users get notified ────────────────────────────────
      //    Admins always qualify; others need explicit RoleModuleAccess for 'prospects'
      const orgUsers = await prisma.user.findMany({
        where: { orgId: prospect.orgId },
        include: { role: true },
      })

      const accessibleUserIds: string[] = []
      for (const u of orgUsers) {
        const roleName = u.role?.name ?? ''
        if (roleName === 'admin' || u.isSuperAdmin) {
          accessibleUserIds.push(u.id)
          continue
        }
        if (u.roleId) {
          const access = await prisma.roleModuleAccess.findUnique({
            where: { roleId_moduleKey: { roleId: u.roleId, moduleKey: 'prospects' } },
          })
          if (access?.hasAccess) accessibleUserIds.push(u.id)
        }
      }

      // ── Handle Approval Notification for Unapproved Follow-ups ───────────────
      if (!fu.is_approved) {
        // Check if we already notified for this specific follow-up
        const existingNotification = await prisma.notification.findFirst({
          where: { link: `/growth/prospects?fu=${fu.id}` }
        })
        if (!existingNotification && accessibleUserIds.length > 0) {
          await prisma.notification.createMany({
            data: accessibleUserIds.map((userId) => ({
              user_id: userId,
              type: 'follow_up',
              title: `Approval Required: ${prospect.name}`,
              message: `A pending follow-up for ${prospect.name} is scheduled for now and requires your approval to be sent.`,
              link: `/growth/prospects?fu=${fu.id}`,
              orgId: prospect.orgId,
            })),
            skipDuplicates: true,
          })
          log(`[follow-up-processor] Approval requested for follow-up ${fu.id}`)
        }
        return // Stop processing this follow-up until it is approved
      }

      // ── 3. Create in-app notifications ─────────────────────────────────────
      if (accessibleUserIds.length > 0) {
        await prisma.notification.createMany({
          data: accessibleUserIds.map((userId) => ({
            user_id: userId,
            type: 'follow_up',
            title: `Follow-Up: ${prospect.name}`,
            message:
              fu.channel === 'email'
                ? `A follow-up email was ${emailOk ? 'sent' : 'attempted (check SMTP logs)'} to ${prospect.name} (${prospect.email}).`
                : `Manual follow-up due for ${prospect.name} (${prospect.email}). Please reach out today.`,
            link: '/growth/prospects',
            orgId: prospect.orgId,
          })),
          skipDuplicates: true,
        })
        log(`[follow-up-processor] Notified ${accessibleUserIds.length} user(s)`)
      }

      // ── 4. Mark as sent / failed ───────────────────────────────────────────
      const newStatus = fu.channel === 'manual' ? 'sent' : emailOk ? 'sent' : 'failed'
      await prisma.prospectFollowUp.update({
        where: { id: fu.id },
        data: { status: newStatus, sent_at: new Date() },
      })
      log(`[follow-up-processor] Follow-up ${fu.id} → ${newStatus}`)
    })
  )

  const processed = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  // Log any rejection reasons
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      log(`[follow-up-processor] Error on item ${i}: ${r.reason}`)
    }
  })

  log(`[follow-up-processor] Done — processed: ${processed}, failed: ${failed}`)
  return { success: true, processed, failed }
}
