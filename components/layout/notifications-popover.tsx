'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotifications } from '@/app/actions/notifications'
import { useSocket } from '@/components/providers/socket-provider'
import { useSession } from 'next-auth/react'
import NotificationCenter from './notification-center'
import { motion, AnimatePresence } from 'framer-motion'

export default function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const { data: session } = useSession()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => getNotifications(),
    staleTime: 30_000,
    // No polling — real-time via Socket.IO
  })

  const unreadCount = (notifications as any[]).filter(n => !n.is_read).length

  // Subscribe to real-time notifications via socket
  useEffect(() => {
    if (!socket || !session?.user?.id) return

    socket.emit('notifications:join', session.user.id)

    const handleNew = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    socket.on('notification:new', handleNew)
    return () => { socket.off('notification:new', handleNew) }
  }, [socket, session?.user?.id, queryClient])

  return (
    <>
      <button
        id="notifications-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-lg bg-bg-secondary border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-border-muted transition-all"
      >
        <Bell size={15} />

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-bg-secondary shadow-sm"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
