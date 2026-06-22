'use client'

import { motion, Variants } from 'framer-motion'
import { CheckCircle2, FileText, UserPlus, FolderKanban, Clock, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { getActivities } from '@/app/actions/activity'

interface Activity {
  id: string
  action: string
  performed_at: string
  metadata: any
  performed_by: { full_name: string; avatar_url: string | null } | null
  task: { title: string } | null
  project: { name: string } | null
}

interface ActivityClientProps {
  initialActivities: Activity[]
  userRole: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

const getActionIcon = (action: string) => {
  const a = action.toLowerCase()
  if (a.includes('create')) return <FolderKanban size={16} className="text-primary" />
  if (a.includes('assign')) return <UserPlus size={16} className="text-info" />
  if (a.includes('complete')) return <CheckCircle2 size={16} className="text-success" />
  if (a.includes('upload') || a.includes('file')) return <FileText size={16} className="text-warning" />
  return <Clock size={16} className="text-text-muted" />
}

export default function ActivityClient({ initialActivities }: ActivityClientProps) {
  const { data: activitiesData, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const data = await getActivities()
      return data as unknown as Activity[]
    }
  })

  const activities = activitiesData ?? initialActivities

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 w-full">
      <div>
        <h2 className="text-xl font-bold text-text">Activity Logs</h2>
        <p className="text-sm text-text-secondary mt-0.5">Timeline of all actions across projects and tasks</p>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden p-6 relative shadow-card">
        {/* Vertical line */}
        <div className="absolute left-[43px] top-8 bottom-8 w-0.5 bg-border/80" />
        
        {isLoading ? (
          <div className="space-y-4 animate-pulse relative z-10">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-bg-secondary shrink-0"></div>
                <div className="flex-1 bg-bg-secondary h-20 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm relative z-10">No activity logs found.</div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <motion.div key={activity.id} variants={itemVariants} className="flex gap-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center shrink-0 shadow-sm mt-0.5 relative z-10">
                  {getActionIcon(activity.action)}
                </div>
                <div className="flex-1 bg-bg-secondary border border-border rounded-xl p-3.5 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.05)] transition-all group relative overflow-hidden">
                  <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="flex items-start justify-between gap-4 relative z-10">
                    <div>
                      <p className="text-sm text-text-secondary">
                        <span className="font-semibold text-text">{activity.performed_by?.full_name || 'System'}</span>
                        {' '}{activity.action}{' '}
                        {activity.task?.title ? (
                          <span className="font-medium text-text">"{activity.task.title}"</span>
                        ) : activity.project?.name ? (
                          <span className="font-medium text-text">"{activity.project.name}"</span>
                        ) : null}
                      </p>
                      
                      {/* Metadata display if any */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-text-muted bg-bg p-2 rounded-lg border border-border/50">
                          {Object.entries(activity.metadata).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2 mb-1 last:mb-0">
                              <span className="font-medium text-text-secondary capitalize">{k.replace(/_/g, ' ')}:</span>
                              <span className="text-text">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-text-muted whitespace-nowrap bg-bg px-2 py-0.5 rounded-full border border-border/50 shadow-sm">
                      {formatDistanceToNow(new Date(activity.performed_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
