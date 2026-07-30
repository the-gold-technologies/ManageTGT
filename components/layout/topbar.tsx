'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Search, LogOut, User, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'
import { signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import NotificationsPopover from './notifications-popover'
import { MessageSquare } from 'lucide-react'
import ChatDrawer from '@/components/chat/chat-drawer'

import { getGlobalUnreadChatCount } from '@/app/actions/chat'
import { useQuery } from '@tanstack/react-query'

interface TopBarProps {
  user: Profile
}

export default function TopBar({ user }: TopBarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const { data: unreadChatCount = 0 } = useQuery({
    queryKey: ['global-unread-chat-count'],
    queryFn: async () => {
      const count = await getGlobalUnreadChatCount()
      return count
    },
    refetchInterval: 30000 // Refetch every 30 seconds as fallback
  })

  useEffect(() => {
    setMounted(true)
    
    // Show welcome toast once per session
    if (!sessionStorage.getItem('welcome_toast_shown')) {
      // Small timeout to allow hydration and avoid immediate flicker
      setTimeout(() => {
        toast.success(`Welcome back, ${user.full_name}!`)
      }, 500)
      sessionStorage.setItem('welcome_toast_shown', 'true')
    }
  }, [user.full_name])

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const getBreadcrumbs = (path: string) => {
    if (path === '/') return []
    if (path.startsWith('/boards')) return ['Dashboard', 'Boards']
    if (path.startsWith('/calendar')) return ['Dashboard', 'Calendar']
    if (path.startsWith('/clients')) return ['Dashboard', 'Clients']
    if (path.startsWith('/projects')) return ['Dashboard', 'Projects']
    if (path.startsWith('/my-tasks')) return ['Dashboard', 'My Tasks']
    if (path.startsWith('/growth/prospects')) return ['Growth', 'Prospects']
    if (path.startsWith('/finance/revenue')) return ['Finance', 'Revenue']
    if (path.startsWith('/finance/expenses')) return ['Finance', 'Expenses']
    if (path.startsWith('/profitability')) return ['Finance', 'Profitability']
    if (path.startsWith('/targets')) return ['Growth', 'Sales Targets']
    if (path.startsWith('/analytics')) return ['Growth', 'Analytics']
    if (path.startsWith('/team')) return ['System', 'Team']
    if (path.startsWith('/settings')) return ['System', 'Settings']
    if (path.startsWith('/activity')) return ['System', 'Activity Logs']
    if (path.startsWith('/files')) return ['Dashboard', 'Files']
    if (path === '/superadmin/dashboard') return ['Platform Admin', 'Dashboard']
    if (path.startsWith('/superadmin/organizations')) return ['Platform Admin', 'Organizations']
    if (path.startsWith('/superadmin/settings')) return ['Platform Admin', 'Platform Settings']
    if (path.startsWith('/superadmin')) return ['Platform Admin']
    return ['Dashboard']
  }

  const isDashboard = pathname === '/'
  const breadcrumbs = getBreadcrumbs(pathname)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    toast.success('Signed out successfully')
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between px-6 h-16 shrink-0 pt-4">
      {/* Left: greeting or title */}
      <div>
        {isDashboard ? (
          <>
            <h1 className="text-base font-semibold text-text">
              {greeting}, {user.full_name.split(' ')[0]}!
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {format(now, 'EEEE, dd MMM yyyy')}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <span className="text-text-muted">/</span>}
                <span className={idx === breadcrumbs.length - 1 ? 'font-semibold text-text' : 'text-text-secondary'}>
                  {crumb}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: theme + bells + avatar */}
      <div className="flex items-center gap-3">

        {/* Theme Toggle */}
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-lg bg-bg-secondary border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-border-muted transition-all"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* Chat Toggle */}
        <button
          onClick={() => setChatOpen(true)}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text hover:border-border-muted transition-all"
        >
          <MessageSquare size={16} />
          {unreadChatCount > 0 && (
            <div className="absolute -top-2 -right-1 min-w-[18px] h-5 font-normal rounded-full bg-primary flex items-center justify-center px-1 text-[10px] font-bold text-white border-2 border-bg-secondary">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </div>
          )}
        </button>

        {/* Notifications */}
        <NotificationsPopover />

        {/* Chat Drawer */}
        <ChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} />

        {/* Avatar */}
        <div className="relative" ref={menuRef}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"
          >
            {user.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={user.avatar_url} 
                alt={user.full_name} 
                className="w-full h-full rounded-full object-cover absolute inset-0 z-10" 
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            <span className="relative z-0">{getInitials(user.full_name)}</span>
          </div>

          {/* Profile Menu Dropdown */}
          <AnimatePresence>
            {showProfileMenu && (
                <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 min-w-[14rem] max-w-[20rem] w-max rounded-xl bg-bg-secondary border border-border shadow-card overflow-hidden z-50"
              >
                <div className="p-4 border-b border-border">
                  <p className="text-sm font-semibold text-text truncate">{user.full_name}</p>
                  <div className="flex flex-wrap items-center gap-x-1 mt-1">
                    <p className="text-xs text-text-muted capitalize shrink-0">{user.role.replace('_', ' ')}</p>
                    {user.orgName && (
                      <>
                        <span className="text-text-muted text-[10px] shrink-0">•</span>
                        <p className="text-xs font-medium text-primary break-words whitespace-normal">{user.orgName}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-2">
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      if (user.role === 'platform_owner' || user.isSuperAdmin) {
                        router.push('/superadmin/settings')
                      } else {
                        router.push('/settings')
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    <User size={16} />
                    Profile Settings
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-danger hover:bg-danger-muted rounded-lg transition-colors mt-1"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
