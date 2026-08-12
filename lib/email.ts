import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})


export async function sendMeetingInvite(
  toEmails: string[],
  eventDetails: {
    title: string
    description?: string
    startDate: string | Date
    meetingUrl: string
    platform: 'google_meet' | 'zoom'
  }
) {
  const validEmails = toEmails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  if (validEmails.length === 0) {
    console.warn('No valid email recipients found, skipping meeting invite email.')
    return
  }

  const platformName = eventDetails.platform === 'google_meet' ? 'Google Meet' : 'Zoom'
  
  // Format date safely
  const dateObj = new Date(eventDetails.startDate)
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : String(eventDetails.startDate)

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #333;">Meeting Invitation: ${eventDetails.title}</h2>
      <p>Hi,</p>
      <p>You have been invited to a ${platformName} meeting.</p>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong><br>${formattedDate}</p>
        ${eventDetails.description ? `<p style="margin: 0;"><strong>Description:</strong><br>${eventDetails.description}</p>` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${eventDetails.meetingUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Join ${platformName} Meeting</a>
      </div>
      
      <p style="color: #666; font-size: 14px;">Or paste this link into your browser:<br><a href="${eventDetails.meetingUrl}">${eventDetails.meetingUrl}</a></p>
      
      <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 40px;" />
      <p style="color: #999; font-size: 10px;">The Gold Technologies (TGT) Internal Platform</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmails.join(','),
      subject: `Invitation: ${eventDetails.title}`,
      html,
    })
    console.log(`Meeting invite sent to ${toEmails.join(', ')}`)
  } catch (error) {
    console.error('Error sending meeting invite:', error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-Up Email — sent to the prospect (client) on a scheduled date
// ─────────────────────────────────────────────────────────────────────────────
export async function sendFollowUpEmail(opts: {
  toEmail: string
  prospectName: string
  agencyName?: string
  proposalDate?: string
  customNote?: string // editable message body set by admin at scheduling time
}) {
  const { toEmail, prospectName, agencyName = 'The Gold Technologies', proposalDate, customNote } = opts

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)
  if (!valid) {
    console.warn('sendFollowUpEmail: invalid email, skipping.', toEmail)
    return { success: false, error: 'Invalid email' }
  }

  const proposalRef = proposalDate
    ? `sent on ${new Date(proposalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'recently sent'

  const defaultBody = `We hope this message finds you well.\n\nWe wanted to follow up on the proposal we ${proposalRef} and check if you had any questions or needed any clarifications.\n\nWe are excited about the possibility of working together and would love to hear your thoughts.`

  const messageBody = (customNote && customNote.trim()) ? customNote.trim() : defaultBody

  // Convert newlines to <br> tags for HTML
  const messageHtml = messageBody.replace(/\n/g, '<br>')

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%); padding: 32px 40px;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${agencyName}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #9ca3af;">Proposal Follow-Up</p>
      </div>

      <!-- Body -->
      <div style="padding: 36px 40px;">
        <p style="margin: 0 0 16px; font-size: 16px; color: #111827;">Hi <strong>${prospectName}</strong>,</p>
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.75; color: #374151;">${messageHtml}</p>

        <div style="background: #f5f3ff; border-left: 4px solid #6366f1; border-radius: 6px; padding: 16px 20px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.65;">Feel free to reply to this email or reach out to us directly. We are happy to schedule a quick call at your convenience.</p>
        </div>

        <p style="margin: 24px 0 0; font-size: 15px; color: #374151;">Looking forward to hearing from you.</p>
        <p style="margin: 10px 0 0; font-size: 15px; font-weight: 600; color: #111827;">Warm regards,<br>${agencyName} Team</p>
      </div>

      <!-- Footer -->
      <div style="background: #f9fafb; padding: 16px 40px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">This is an automated follow-up reminder from ${agencyName}. If you have already responded, please disregard this email.</p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"${agencyName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Following up on our Proposal — ${agencyName}`,
      html,
    })
    console.log(`Follow-up email sent to ${toEmail}`)
    return { success: true }
  } catch (error) {
    console.error('Error sending follow-up email:', error)
    return { success: false, error }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Email — sent from the Notification Engine
// ─────────────────────────────────────────────────────────────────────────────

const NOTIF_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  task_assigned:     { label: 'Task Assigned',     color: '#6366f1' },
  task_status:       { label: 'Task Update',       color: '#3b82f6' },
  task_overdue:      { label: 'Task Overdue',      color: '#ef4444' },
  task_due_soon:     { label: 'Due Soon',          color: '#f97316' },
  project_assigned:  { label: 'Project Assigned',  color: '#06b6d4' },
  approval_required: { label: 'Approval Required', color: '#f59e0b' },
  approval_granted:  { label: 'Approved',          color: '#22c55e' },
  invoice_update:    { label: 'Invoice Update',    color: '#10b981' },
  payment_received:  { label: 'Payment Received',  color: '#10b981' },
  system_alert:      { label: 'System Alert',      color: '#ef4444' },
  reminder:          { label: 'Reminder',          color: '#f97316' },
}

export async function sendNotificationEmail(opts: {
  toEmail: string
  recipientName: string
  notification: {
    title: string
    body: string
    link?: string
    type: string
  }
}) {
  const { toEmail, recipientName, notification } = opts

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)
  if (!valid) {
    console.warn('sendNotificationEmail: invalid email, skipping.', toEmail)
    return { success: false, error: 'Invalid email' }
  }

  const typeMeta = NOTIF_TYPE_LABELS[notification.type] ?? { label: 'Notification', color: '#6366f1' }
  const appUrl   = process.env.NEXTAUTH_URL || 'https://agencyos.app'
  const viewUrl  = notification.link ? `${appUrl}${notification.link}` : appUrl

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a2e 100%);padding:28px 36px;border-bottom:3px solid ${typeMeta.color};">
        <div style="display:inline-block;background:${typeMeta.color}22;border:1px solid ${typeMeta.color}44;border-radius:8px;padding:5px 12px;margin-bottom:14px;">
          <span style="font-size:11px;font-weight:700;color:${typeMeta.color};letter-spacing:0.5px;text-transform:uppercase;">${typeMeta.label}</span>
        </div>
        <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">AgencyOS</h1>
      </div>
      <div style="padding:32px 36px;">
        <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">Hi <strong style="color:#111827;">${recipientName}</strong>,</p>
        <div style="background:#f9fafb;border-left:4px solid ${typeMeta.color};border-radius:8px;padding:18px 20px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827;">${notification.title}</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${notification.body}</p>
        </div>
        <div style="text-align:center;margin:28px 0 8px;">
          <a href="${viewUrl}" style="display:inline-block;background:${typeMeta.color};color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
            View in AgencyOS →
          </a>
        </div>
      </div>
      <div style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
          You received this because your notification preferences include email for this event type.<br/>
          <a href="${appUrl}/settings" style="color:#6366f1;text-decoration:none;">Manage notification preferences</a>
        </p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from:    `"AgencyOS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to:      toEmail,
      subject: `${typeMeta.label}: ${notification.title}`,
      html,
    })
    return { success: true }
  } catch (error) {
    console.error('Error sending notification email:', error)
    return { success: false, error }
  }
}
