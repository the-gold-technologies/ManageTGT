import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import QueryProvider from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AuthProvider } from '@/components/providers/session-provider'
import { SessionSocketProvider } from '@/components/providers/session-socket-provider'
import { PushNotificationProvider } from '@/components/providers/push-notification-provider'

export const metadata: Metadata = {
  title: 'TGT - Business Management Platform',
  description: 'Manage clients, projects, tasks, revenue and team performance in one place.',
  icons: {
    icon: '/logo.jpg',
    // iOS uses this for the home-screen icon; without it the installed PWA
    // shows a screenshot of the page instead.
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AgencyOS',
  },
}

// `viewport` inside `metadata` has been deprecated since Next.js 14 — it must
// be its own export or Next ignores it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6366f1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-text font-sans antialiased transition-colors duration-300" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <QueryProvider>
              <SessionSocketProvider>
                <PushNotificationProvider>
                  {children}
                </PushNotificationProvider>
              </SessionSocketProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'bg-bg border border-border text-text',
              }}
            />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
