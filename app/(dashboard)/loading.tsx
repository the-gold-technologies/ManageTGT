import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-text-secondary animate-pulse">Loading data...</p>
      </div>
    </div>
  )
}
