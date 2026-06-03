'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard Error Boundary caught an error:', error)
  }, [error])

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-6 bg-bg">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-bg-secondary border border-border rounded-2xl p-8 shadow-card text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-danger" />
        
        <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>
        
        <h2 className="text-xl font-bold text-text mb-2">Oops! Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-8">
          A component on this dashboard encountered an unexpected error. Please try refreshing the page.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button onClick={() => window.location.reload()} variant="secondary" className="w-full">
            Refresh Page
          </Button>
          <Button onClick={() => reset()} className="w-full">
            <RefreshCcw size={16} className="mr-2" /> Try Again
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
