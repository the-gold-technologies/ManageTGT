'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FolderKanban, CheckSquare, Settings, Menu, X, Users, DollarSign, TrendingUp, UserCog, CalendarDays, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MobileBottomNavProps {
  allowedModules: string[]
}

const MOBILE_NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Home', moduleKey: 'dashboard' },
  { href: '/projects', icon: FolderKanban, label: 'Projects', moduleKey: 'projects' },
  { href: '/my-tasks', icon: CheckSquare, label: 'Tasks', moduleKey: 'tasks' },
  { href: '/settings', icon: Settings, label: 'Settings', moduleKey: 'settings' },
]

export default function MobileBottomNav({ allowedModules = [] }: MobileBottomNavProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const visibleItems = MOBILE_NAV_ITEMS.filter(item => allowedModules.includes(item.moduleKey))

  if (visibleItems.length === 0) return null

  // All available modules for the expanded menu
  const ALL_MODULES = [
    { section: 'Main', items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard', moduleKey: 'dashboard' },
      { href: '/calendar', icon: CalendarDays, label: 'Calendar', moduleKey: 'calendar' },
      { href: '/clients', icon: Users, label: 'Clients', moduleKey: 'clients' },
      { href: '/projects', icon: FolderKanban, label: 'Projects', moduleKey: 'projects' },
      { href: '/boards', icon: CheckSquare, label: 'Boards', moduleKey: 'tasks' },
      { href: '/my-tasks', icon: CheckSquare, label: 'My Tasks', moduleKey: 'tasks' },
      { href: '/files', icon: FolderOpen, label: 'Files', moduleKey: 'files' },
    ]},
    { section: 'Finance & Growth', items: [
      { href: '/finance/revenue', icon: DollarSign, label: 'Revenue', moduleKey: 'revenue' },
      { href: '/finance/expenses', icon: DollarSign, label: 'Expenses', moduleKey: 'expenses' },
      { href: '/profitability', icon: TrendingUp, label: 'Profitability', moduleKey: 'profitability' },
      { href: '/growth/prospects', icon: Users, label: 'Prospects', moduleKey: 'prospects' },
      { href: '/targets', icon: TrendingUp, label: 'Sales Targets', moduleKey: 'targets' },
      { href: '/analytics', icon: TrendingUp, label: 'Analytics', moduleKey: 'analytics' },
    ]},
    { section: 'System', items: [
      { href: '/team', icon: UserCog, label: 'Team', moduleKey: 'team' },
      { href: '/activity', icon: Settings, label: 'Activity Logs', moduleKey: 'activity' },
      { href: '/settings', icon: Settings, label: 'Settings', moduleKey: 'settings' },
    ]}
  ]

  return (
    <>
      {/* Floating Bottom Nav */}
      <div className="flex md:hidden fixed bottom-4 left-4 right-4 z-30 bg-bg-secondary/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl px-2 py-1">
        <div className="flex items-center justify-around w-full h-14">
          {visibleItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 select-none",
                  isActive ? "text-primary" : "text-text-muted hover:text-text-secondary"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={cn(
                  "flex items-center justify-center w-14 h-8 rounded-full transition-colors duration-200",
                  isActive ? "bg-primary text-primary-foreground shadow-glow-sm" : "text-text-secondary"
                )}>
                  <item.icon size={20} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors duration-200",
                  isActive ? "text-primary" : "text-text-secondary"
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          
          {/* Menu Toggle Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 select-none",
              menuOpen ? "text-primary" : "text-text-muted hover:text-text-secondary"
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
             <div className={cn(
                "flex items-center justify-center w-14 h-8 rounded-full transition-colors duration-200",
                menuOpen ? "bg-primary text-primary-foreground shadow-glow-sm" : "text-text-secondary"
              )}>
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors duration-200",
                menuOpen ? "text-primary" : "text-text-secondary"
              )}>
                Menu
              </span>
          </button>
        </div>
      </div>

      {/* Full Screen Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[80] bg-bg flex flex-col md:hidden pb-24 pt-6 px-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-xl font-bold text-text">Menu</span>
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-2 -mr-2 rounded-full hover:bg-bg-secondary text-text-muted hover:text-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {ALL_MODULES.map((section, idx) => {
                const availableItems = section.items.filter(item => allowedModules.includes(item.moduleKey))
                if (availableItems.length === 0) return null

                return (
                  <div key={idx} className="space-y-3">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{section.section}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {availableItems.map(item => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border transition-all",
                              isActive ? "bg-primary text-primary-foreground border-transparent shadow-glow-sm" : "bg-bg-secondary border-border text-text-secondary hover:text-text hover:border-border-muted"
                            )}
                          >
                            <item.icon size={18} />
                            <span className="text-sm font-medium">{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
