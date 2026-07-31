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
    
    const result = await signIn('credentials', {
      ...credentials,
      redirect: false,
    })
    
    // If we reach here, signIn was successful (or returned an error string we should handle, but Auth.js v5 throws AuthError on failure even with redirect: false, except for success where it returns).
    return { success: true }
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid credentials.' }
        default:
          return { error: 'Something went wrong.' }
      }
    }
    // If it's a redirect error (which shouldn't happen with redirect: false, but just in case), let it throw.
    throw error
  }
}

export async function signInWithGoogle() {
  revalidatePath('/', 'layout')
  await signIn('google', { redirectTo: '/?login=success' })
}
