'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

/**
 * Handles forgot password request
 * Generates a reset token and sends an email via SMTP
 */
export async function forgotPasswordAction(prevState: any, formData: FormData) {
  try {
    const email = formData.get('email') as string
    if (!email) {
      return { error: 'Email is required.' }
    }

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      // Return success to prevent email enumeration attacks
      return { success: true, message: 'If an account exists with that email, a reset link has been sent.' }
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 3600 * 1000) // 1 hour expiration

    // Save token to database
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires
      }
    })

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`
    
    // Log the link to the console for fallback/development
    console.log('\n=========================================')
    console.log('PASSWORD RESET REQUEST RECEIVED')
    console.log(`Email: ${email}`)
    console.log(`Reset Link: ${resetLink}`)
    console.log('=========================================\n')

    // Send email using SMTP
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Reset your TGT password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hi,</p>
          <p>We received a request to reset your password for your TGT account. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 12px;">This link will expire in 1 hour. If you did not make this request, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea;" />
          <p style="color: #999; font-size: 10px;">The Gold Technologies (TGT) Internal Platform</p>
        </div>
      `,
    })

    return { success: true, message: 'If an account exists with that email, a reset link has been sent.' }
  } catch (error) {
    console.error('Forgot password error:', error)
    return { error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Handles password reset completion using the verification token
 */
export async function resetPasswordAction(prevState: any, formData: FormData) {
  try {
    const token = formData.get('token') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!token) {
      return { error: 'Invalid or missing token.' }
    }

    if (!password || !confirmPassword) {
      return { error: 'Please fill in all fields.' }
    }

    if (password !== confirmPassword) {
      return { error: 'Passwords do not match.' }
    }

    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters long.' }
    }

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    })

    if (!resetToken || resetToken.expires < new Date()) {
      return { error: 'Reset token is invalid or has expired.' }
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email }
    })

    if (!user) {
      return { error: 'User associated with this token was not found.' }
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password and delete the token
    await prisma.$transaction([
      prisma.user.update({
        where: { email: resetToken.email },
        data: { password: hashedPassword }
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id }
      })
    ])

    return { success: true }
  } catch (error) {
    console.error('Reset password error:', error)
    return { error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Handles changing the password from inside the settings page
 */
export async function changePasswordAction(prevState: any, formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { error: 'Unauthorized.' }
    }

    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmNewPassword') as string

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: 'All fields are required.' }
    }

    if (newPassword !== confirmPassword) {
      return { error: 'New passwords do not match.' }
    }

    if (newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters long.' }
    }

    // Fetch user details from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return { error: 'User not found.' }
    }

    // Check if user has password set (Oauth users might not have a password)
    if (user.password) {
      const isValid = await bcrypt.compare(currentPassword, user.password)
      if (!isValid) {
        return { error: 'Incorrect current password.' }
      }
    } else {
      // If user signed up with Google and has no password, they can just set one
      // We don't require checking currentPassword in this scenario, or they can input any placeholder
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update the password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword }
    })

    return { success: true }
  } catch (error) {
    console.error('Change password error:', error)
    return { error: 'Something went wrong. Please try again.' }
  }
}
