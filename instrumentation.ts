export async function register() {
  console.log('[Instrumentation] register() called, runtime:', process.env.NEXT_RUNTIME)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startNotificationWorkers } = await import('./lib/notification-queue')
      startNotificationWorkers()
      console.log('> Notification workers started (Next.js Instrumentation)')
    } catch (err: any) {
      console.warn('> Notification workers not started:', err.message)
    }
  }
}
