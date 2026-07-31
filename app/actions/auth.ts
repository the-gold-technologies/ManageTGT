'use server'

import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function loginAction(prevState: any, formData: FormData) {
  try {
    const credentials = Object.fromEntries(formData)
    
    // Clear the router cache so layout evaluates auth correctly on redirect
    revalidatePath('/', 'layout')
    
    await signIn('credentials', {
      ...credentials,
      redirectTo: '/?login=success',
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

export async function signInWithGoogle() {
  revalidatePath('/', 'layout')
  await signIn('google', { redirectTo: '/?login=success' })
}
