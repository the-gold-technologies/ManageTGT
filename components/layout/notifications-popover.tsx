'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markAsRead, markAllAsRead } from '@/app/actions/notifications'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    refetchInterval: 30000 // Poll every 30 seconds
  })

  const prevUnreadCountRef = useRef(0)

  useEffect(() => {
    const unreadNotifications = notifications.filter((n: any) => !n.is_read)
    const currentUnreadCount = unreadNotifications.length
    
    if (currentUnreadCount > prevUnreadCountRef.current) {
      const newestUnread = unreadNotifications[0]
      if (newestUnread && (newestUnread.type === 'task_status' || newestUnread.type === 'task_assigned')) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      }
      if (newestUnread && newestUnread.type === 'project_assigned') {
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
    }
    prevUnreadCountRef.current = currentUnreadCount
  }, [notifications, queryClient])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleNotificationClick = (id: string, is_read: boolean) => {
    if (!is_read) {
      markReadMutation.mutate(id)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-lg bg-bg-secondary border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-border-muted transition-all"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border border-bg-secondary" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-[28rem] rounded-xl bg-bg-secondary border border-border shadow-card z-50 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-bg/50">
              <h3 className="text-sm font-semibold text-text">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  <Check size={12} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[22rem]">
              {isLoading ? (
                <div className="p-4 text-center text-text-muted text-xs">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-text-muted flex flex-col items-center gap-2">
                  <Bell size={24} className="opacity-20" />
                  <p className="text-xs">No notifications yet</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 border-b border-border last:border-0 hover:bg-bg-tertiary transition-colors cursor-pointer group ${!notif.is_read ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        if (notif.link) {
                          // we handle routing via the Link component wrapper inside, but for marking read:
                          handleNotificationClick(notif.id, notif.is_read)
                        } else {
                          handleNotificationClick(notif.id, notif.is_read)
                        }
                      }}
                    >
                      {notif.link ? (
                        <Link href={notif.link} className="flex gap-3">
                          <NotificationContent notif={notif} />
                        </Link>
                      ) : (
                        <div className="flex gap-3">
                          <NotificationContent notif={notif} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotificationContent({ notif }: { notif: any }) {
  return (
    <>
      <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${!notif.is_read ? 'bg-primary' : 'bg-transparent'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${!notif.is_read ? 'font-semibold text-text' : 'font-medium text-text-secondary'}`}>
            {notif.title}
          </p>
          <p className="text-[10px] text-text-muted shrink-0">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </p>
        </div>
        <p className={`text-xs mt-0.5 line-clamp-2 ${!notif.is_read ? 'text-text-secondary' : 'text-text-muted'}`}>
          {notif.message}
        </p>
      </div>
    </>
  )
}
