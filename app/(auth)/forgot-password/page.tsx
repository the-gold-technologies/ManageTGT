'use client'

import { useActionState, Suspense } from 'react'
import { forgotPasswordAction } from '@/app/actions/password'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useFormStatus } from 'react-dom'
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
          Sending Link...
        </>
      ) : (
        'Send Recovery Link'
      )}
    </button>
  )
}

function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, undefined)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
    if (state?.success && state?.message) {
      toast.success(state.message)
    }
  }, [state])

  if (state?.success) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card text-center space-y-5">
        <div className="mx-auto w-12 h-12 bg-green-500/10 border border-green-500/20 text-green-500 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text">Link Sent Successfully</h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            We have sent a secure password reset link to your email address. Please check your inbox and spam folder.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
          >
            <ArrowLeft size={14} /> Back to Login
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
        
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-text-secondary">
            Email address
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@agency.com"
              required
              className="w-full pl-10 pr-4 py-3 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Submit */}
        <SubmitButton />
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={14} /> Back to Login
        </Link>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
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
          <h2 className="text-xl font-bold text-text mt-4">Reset Password</h2>
          <p className="text-sm text-text-secondary mt-1">Enter your email to receive a recovery link</p>
        </div>

        <Suspense fallback={
          <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card flex flex-col items-center justify-center h-[220px]">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
            <p className="text-sm text-text-muted mt-4">Loading recovery form...</p>
          </div>
        }>
          <ForgotPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  )
}
