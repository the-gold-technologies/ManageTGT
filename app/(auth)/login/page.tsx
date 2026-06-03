'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'

function SubmitButton() {
  const { pending } = useFormStatus()
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-glow-sm mt-2"
    >
      {pending ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          Sign in
          <ArrowRight size={15} />
        </>
      )}
    </button>
  )
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  
  // In React 19 / Next.js 15, we use useActionState. If not available, we could use useFormState from react-dom.
  // We'll use the modern signature which takes (action, initialState)
  const [state, formAction] = useActionState(loginAction, undefined)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

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
          <img src="/logo.png" alt="" className="mx-auto" height={100} width={100} />
          <h1 className="text-2xl font-bold text-text">AgencyOS</h1>
          <p className="text-sm text-text-secondary mt-1">Sign in to your workspace</p>
        </div>

        {/* Form card */}
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

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-text-secondary">
                Password
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

            {/* Submit */}
            <SubmitButton />
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Internal tool contact your admin to get access
        </p>
      </motion.div>
    </div>
  )
}
