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

      {/* Right: search + bells + avatar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        {!(pathname.startsWith('/boards') || pathname.startsWith('/my-tasks')) && (
          <div className="relative hidden md:flex items-center">
            <Search size={14} className="absolute left-3 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-8 pr-4 py-2 text-sm bg-bg-secondary border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 w-48 transition-all focus:w-64"
            />
          </div>
        )}

        {/* Theme Toggle */}
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-lg bg-bg-secondary border border-border flex items-center justify-center text-text-secondary hover:text-text hover:border-border-muted transition-all"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* Notifications */}
        <NotificationsPopover />

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
                className="absolute right-0 mt-2 w-56 rounded-xl bg-bg-secondary border border-border shadow-card overflow-hidden z-50"
              >
                <div className="p-4 border-b border-border">
                  <p className="text-sm font-semibold text-text">{user.full_name}</p>
                  <p className="text-xs text-text-muted mt-1 capitalize truncate">{user.role.replace('_', ' ')}</p>
                </div>
                <div className="p-2">
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false)
                      router.push('/settings')
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
