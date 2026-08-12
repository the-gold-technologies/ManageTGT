'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Check, Trash2, X, CheckCheck,
  ClipboardList, MessageSquare, FolderOpen,
  DollarSign, AlertCircle, Users, Clock, FileText,
  ThumbsUp, Upload, ChevronRight, Settings,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications, markAsRead, markAllAsRead,
  deleteNotification, deleteAllReadNotifications,
} from '@/app/actions/notifications'
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns'
import Link from 'next/link'
import { useSocket } from '@/components/providers/socket-provider'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'task_assigned' | 'task_status' | 'task_overdue' | 'task_due_soon'
  | 'mention' | 'comment'
  | 'project_assigned' | 'project_update'
  | 'approval_required' | 'approval_granted'
  | 'invoice_update' | 'payment_received'
  | 'file_uploaded' | 'team_update' | 'system_alert' | 'reminder'
  | string

type Tab = 'all' | 'unread' | 'tasks' | 'finance' | 'system'

// ─── Icon + Color Map ─────────────────────────────────────────────────────────

function getNotificationMeta(type: NotificationType): {
  icon: React.ReactNode
  color: string
  bg: string
  category: Tab
} {
  const map: Record<string, { icon: React.ReactNode; color: string; bg: string; category: Tab }> = {
    task_assigned:     { icon: <ClipboardList size={13} />, color: 'text-indigo-400',  bg: 'bg-indigo-500/15', category: 'tasks' },
    task_status:       { icon: <ClipboardList size={13} />, color: 'text-blue-400',    bg: 'bg-blue-500/15',   category: 'tasks' },
    task_overdue:      { icon: <Clock size={13} />,         color: 'text-red-400',     bg: 'bg-red-500/15',    category: 'tasks' },
    task_due_soon:     { icon: <Clock size={13} />,         color: 'text-orange-400',  bg: 'bg-orange-500/15', category: 'tasks' },
    mention:           { icon: <MessageSquare size={13} />, color: 'text-violet-400',  bg: 'bg-violet-500/15', category: 'system' },
    comment:           { icon: <MessageSquare size={13} />, color: 'text-violet-400',  bg: 'bg-violet-500/15', category: 'system' },
    project_assigned:  { icon: <FolderOpen size={13} />,   color: 'text-cyan-400',    bg: 'bg-cyan-500/15',   category: 'tasks' },
    project_update:    { icon: <FolderOpen size={13} />,   color: 'text-cyan-400',    bg: 'bg-cyan-500/15',   category: 'tasks' },
    approval_required: { icon: <AlertCircle size={13} />,  color: 'text-amber-400',   bg: 'bg-amber-500/15',  category: 'system' },
    approval_granted:  { icon: <ThumbsUp size={13} />,     color: 'text-green-400',   bg: 'bg-green-500/15',  category: 'system' },
    invoice_update:    { icon: <DollarSign size={13} />,   color: 'text-emerald-400', bg: 'bg-emerald-500/15',category: 'finance' },
    payment_received:  { icon: <DollarSign size={13} />,   color: 'text-emerald-400', bg: 'bg-emerald-500/15',category: 'finance' },
    file_uploaded:     { icon: <Upload size={13} />,       color: 'text-sky-400',     bg: 'bg-sky-500/15',    category: 'system' },
    team_update:       { icon: <Users size={13} />,        color: 'text-pink-400',    bg: 'bg-pink-500/15',   category: 'system' },
    system_alert:      { icon: <AlertCircle size={13} />,  color: 'text-red-400',     bg: 'bg-red-500/15',    category: 'system' },
    reminder:          { icon: <Clock size={13} />,        color: 'text-orange-400',  bg: 'bg-orange-500/15', category: 'system' },
  }
  return map[type] ?? { icon: <Bell size={13} />, color: 'text-text-secondary', bg: 'bg-bg-tertiary', category: 'system' }
}

// ─── Date Grouping ────────────────────────────────────────────────────────────

function getGroup(date: Date): string {
  if (isToday(date))       return 'Today'
  if (isYesterday(date))   return 'Yesterday'
  if (isThisWeek(date))    return 'This Week'
  return 'Earlier'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']

// ─── Main Component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const { data: session } = useSession()

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => getNotifications(),
    staleTime: 30_000,
  })

  // ── Real-time via Socket.IO ───────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !session?.user?.id) return

    // Join personal notification room
    socket.emit('notifications:join', session.user.id)

    const handleNew = (notif: unknown) => {
      queryClient.setQueryData(['notifications'], (old: typeof notifications) => {
        if (!old) return [notif]
        return [notif, ...old]
      })
    }

    socket.on('notification:new', handleNew)
    return () => { socket.off('notification:new', handleNew) }
  }, [socket, session?.user?.id, queryClient])

  // ── Click Outside ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const clearReadMutation = useMutation({
    mutationFn: deleteAllReadNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Read notifications cleared')
    },
  })

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = notifications.filter((n: any) => {
    if (activeTab === 'unread') return !n.is_read
    if (activeTab === 'tasks')  return ['task_assigned','task_status','task_overdue','task_due_soon','project_assigned','project_update'].includes(n.type)
    if (activeTab === 'finance')return ['invoice_update','payment_received'].includes(n.type)
    if (activeTab === 'system') return ['mention','comment','approval_required','approval_granted','file_uploaded','team_update','system_alert','reminder'].includes(n.type)
    return true
  })

  const unreadCount = notifications.filter((n: any) => !n.is_read).length

  // ── Group by date ─────────────────────────────────────────────────────────

  const groups: Record<string, typeof filtered> = {}
  for (const notif of filtered) {
    const g = getGroup(new Date((notif as any).createdAt))
    if (!groups[g]) groups[g] = []
    groups[g].push(notif)
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'all',     label: 'All',     count: notifications.length },
    { id: 'unread',  label: 'Unread',  count: unreadCount },
    { id: 'tasks',   label: 'Tasks' },
    { id: 'finance', label: 'Finance' },
    { id: 'system',  label: 'System' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: 20, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed right-4 top-20 z-50 w-[22rem] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl bg-bg-secondary border border-border shadow-[0_8px_40px_rgba(0,0,0,0.3)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-primary" />
                <h2 className="text-sm font-semibold text-text">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    title="Mark all as read"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <CheckCheck size={13} />
                  </button>
                )}
                {notifications.some((n: any) => n.is_read) && (
                  <button
                    onClick={() => clearReadMutation.mutate()}
                    disabled={clearReadMutation.isPending}
                    title="Clear read notifications"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <Link
                  href="/settings?tab=notifications"
                  onClick={onClose}
                  title="Notification settings"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
                >
                  <Settings size={13} />
                </Link>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 px-3 pt-2 pb-2 border-b border-border shrink-0 overflow-x-auto scrollbar-hide">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
                  }`}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className={`text-[9px] font-bold px-1 rounded-full ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-bg-tertiary text-text-muted'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-bg-tertiary/50 animate-pulse">
                      <div className="w-7 h-7 rounded-lg bg-bg-tertiary shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-bg-tertiary rounded w-3/4" />
                        <div className="h-2.5 bg-bg-tertiary rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center">
                    <Bell size={20} className="text-text-muted opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-secondary">
                      {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {activeTab === 'unread' ? 'No unread notifications.' : 'Notifications will appear here.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  {GROUP_ORDER.filter(g => groups[g]?.length).map(groupName => (
                    <div key={groupName}>
                      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 py-2">
                        {groupName}
                      </p>
                      {groups[groupName].map((notif: any) => {
                        const meta = getNotificationMeta(notif.type)
                        return (
                          <NotificationItem
                            key={notif.id}
                            notif={notif}
                            meta={meta}
                            onMarkRead={() => markReadMutation.mutate(notif.id)}
                            onDelete={() => deleteMutation.mutate(notif.id)}
                            onClose={onClose}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Notification Item ────────────────────────────────────────────────────────

function NotificationItem({
  notif,
  meta,
  onMarkRead,
  onDelete,
  onClose,
}: {
  notif: any
  meta: ReturnType<typeof getNotificationMeta>
  onMarkRead: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  const content = (
    <div
      className={`relative flex gap-3 p-3 rounded-xl transition-all cursor-pointer group ${
        !notif.is_read
          ? 'bg-primary/5 hover:bg-primary/8'
          : 'hover:bg-bg-tertiary'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => { if (!notif.is_read) onMarkRead() }}
    >
      {/* Icon */}
      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${meta.bg} ${meta.color}`}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs leading-snug ${!notif.is_read ? 'font-semibold text-text' : 'font-medium text-text-secondary'}`}>
            {notif.title}
          </p>
          <span className="text-[10px] text-text-muted shrink-0 mt-0.5">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className={`text-[11px] mt-0.5 leading-snug line-clamp-2 ${!notif.is_read ? 'text-text-secondary' : 'text-text-muted'}`}>
          {notif.message}
        </p>
      </div>

      {/* Unread dot */}
      {!notif.is_read && (
        <div className="absolute right-3 bottom-3 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      {/* Hover actions */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="absolute top-2 right-2 flex items-center gap-1 bg-bg-secondary border border-border rounded-lg shadow-sm p-0.5"
            onClick={e => e.stopPropagation()}
          >
            {!notif.is_read && (
              <button
                onClick={onMarkRead}
                title="Mark as read"
                className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Check size={11} />
              </button>
            )}
            <button
              onClick={onDelete}
              title="Delete"
              className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <X size={11} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  if (notif.link) {
    return (
      <Link href={notif.link} onClick={onClose} className="block">
        {content}
      </Link>
    )
  }

  return content
}
