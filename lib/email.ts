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
