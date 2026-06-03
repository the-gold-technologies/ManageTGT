'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

export async function loginAction(prevState: any, formData: FormData) {
  try {
    const credentials = Object.fromEntries(formData)
    await signIn('credentials', {
      ...credentials,
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid credentials.' }
        default:
          return { error: 'Something went wrong.' }
      }
    }
    throw error // Important: Next.js redirect must be rethrown
  }
}
