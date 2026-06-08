'use client'

import { useActionState, Suspense } from 'react'
import { loginAction, signInWithGoogle } from '@/app/actions/auth'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
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

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  
  let oauthErrorMessage = ''
  if (errorParam) {
    switch (errorParam) {
      case 'OAuthAccountNotLinked':
        oauthErrorMessage = 'An account with this email already exists. Please sign in using your email and password, or register this provider in your settings.'
        break
      case 'OAuthCallback':
        oauthErrorMessage = 'There was an error completing the authentication callback from Google.'
        break
      case 'OAuthSignin':
        oauthErrorMessage = 'Failed to redirect to the Google login page. Please try again.'
        break
      case 'OAuthCreateAccount':
        oauthErrorMessage = 'We could not create your user account using Google auth. Please contact support.'
        break
      case 'Callback':
        oauthErrorMessage = 'A callback error occurred. Please try logging in again.'
        break
      case 'AccessDenied':
        oauthErrorMessage = 'Access denied. You do not have permission to view this resource.'
        break
      case 'CredentialsSignin':
        oauthErrorMessage = 'Invalid email or password.'
        break
      default:
        oauthErrorMessage = 'An unexpected authentication error occurred.'
    }
  }

  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction] = useActionState(loginAction, undefined)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card">
      {/* OAuth/Redirect Error Messages */}
      {oauthErrorMessage && (
        <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-400">Authentication Issue</p>
            <p className="mt-1 leading-relaxed">{oauthErrorMessage}</p>
          </div>
        </div>
      )}

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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-text-secondary">
              Password
            </label>
            <a href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
              Forgot password?
            </a>
          </div>
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

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase">
          <span className="bg-bg-secondary px-3 text-text-muted">Or continue with</span>
        </div>
      </div>

      {/* Google Sign-in */}
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-bg border border-border hover:bg-bg-tertiary text-text rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              style={{ fill: '#4285F4' }}
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              style={{ fill: '#34A853' }}
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              style={{ fill: '#FBBC05' }}
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              style={{ fill: '#EA4335' }}
            />
          </svg>
          Sign in with Google
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
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
          <p className="text-sm text-text-secondary mt-2">Sign in to your workspace</p>
        </div>

        {/* Form card wrapped in Suspense */}
        <Suspense fallback={
          <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-card flex flex-col items-center justify-center h-[350px]">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
            <p className="text-sm text-text-muted mt-4">Loading login portal...</p>
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-text-muted mt-6">
          Internal tool contact your admin to get access
        </p>
      </motion.div>
    </div>
  )
}
