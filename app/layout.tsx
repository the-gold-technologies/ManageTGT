import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import QueryProvider from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'

export const metadata: Metadata = {
  title: 'AgencyOS - Business Management Platform',
  description: 'Manage clients, projects, tasks, revenue and team performance in one place.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-text font-sans antialiased transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'bg-bg border border-border text-text',
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
