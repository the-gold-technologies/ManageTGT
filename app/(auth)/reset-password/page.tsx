'use client'

import { useActionState, Suspense } from 'react'
import { resetPasswordAction } from '@/app/actions/password'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-sm"
    >
      {pending ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Updating Password...
        </>
      ) : (
        'Reset Password'
      )}
    </button>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction] = useActionState(resetPasswordAction, undefined)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

  if (!token) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text">Invalid Reset Link</h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            The password reset token is missing or invalid. Please request a new recovery link.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/forgot-password"
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all"
          >
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  if (state?.success) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card text-center space-y-5">
        <div className="mx-auto w-12 h-12 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text">Password Updated</h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            Your password has been changed successfully. You can now log in to your account with your new password.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card">
      <form action={formAction} className="space-y-5">
        {state?.error && (
          <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
            {state.error}
          </div>
        )}
        
        {/* Hidden token field */}
        <input type="hidden" name="token" value={token} />

        {/* New Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-text-secondary">
            New Password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-10 py-3 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-text-secondary">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-10 py-3 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Submit */}
        <SubmitButton />
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="TGT" className="mx-auto rounded-full object-cover w-[100px] h-[100px]" />
          <h2 className="text-xl font-bold text-text mt-4">Create New Password</h2>
          <p className="text-sm text-text-secondary mt-1">Please type a new secure password below</p>
        </div>

        <Suspense fallback={
          <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card flex flex-col items-center justify-center h-[280px]">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
            <p className="text-sm text-text-muted mt-4">Loading reset portal...</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  )
}
