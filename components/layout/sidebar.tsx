'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Settings,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Wallet,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Clock,
  KanbanSquare,
  CalendarDays,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'team_lead' | 'team_member' | 'sales_executive'

type NavItem = {
  href: string
  icon: any
  label: string
  moduleKey: string
}

type NavSection = {
  label?: string
  icon?: any
  moduleKey?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard', moduleKey: 'dashboard' },
      { href: '/calendar', icon: CalendarDays, label: 'Calendar', moduleKey: 'calendar' },
      { href: '/clients', icon: Users, label: 'Clients', moduleKey: 'clients' },
      { href: '/projects', icon: FolderKanban, label: 'Projects', moduleKey: 'projects' },
      { href: '/boards', icon: KanbanSquare, label: 'Boards', moduleKey: 'tasks' },
      { href: '/my-tasks', icon: CheckSquare, label: 'My Tasks', moduleKey: 'tasks' },
      { href: '/files', icon: FolderOpen, label: 'Files', moduleKey: 'files' },
    ]
  },
  {
    label: 'Finance',
    icon: DollarSign,
    moduleKey: 'finance', // can group or ignore for section visibility
    items: [
      { href: '/finance/revenue', icon: Receipt, label: 'Revenue', moduleKey: 'revenue' },
      { href: '/finance/expenses', icon: Wallet, label: 'Expenses', moduleKey: 'expenses' },
      { href: '/profitability', icon: TrendingUp, label: 'Profitability', moduleKey: 'profitability' },
    ]
  },
  {
    label: 'Growth',
    icon: TrendingUp,
    moduleKey: 'growth',
    items: [
      { href: '/growth/prospects', icon: Users, label: 'Prospects', moduleKey: 'prospects' },
      { href: '/targets', icon: Target, label: 'Sales Targets', moduleKey: 'targets' },
      { href: '/analytics', icon: BarChart3, label: 'Analytics', moduleKey: 'analytics' },
    ]
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { href: '/team', icon: UserCog, label: 'Team', moduleKey: 'team' },
      { href: '/activity', icon: Clock, label: 'Activity Logs', moduleKey: 'activity' },
      { href: '/settings', icon: Settings, label: 'Settings', moduleKey: 'settings' },
    ]
  }
]

interface SidebarProps {
  allowedModules: string[]
}

export default function Sidebar({ allowedModules = [] }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  
  const pathname = usePathname()

  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      if (prev[label]) return {} // close if already open
      return { [label]: true } // open only this one
    })
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 220 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-[calc(100vh-1.5rem)] my-3 ml-2 bg-bg-secondary rounded-2xl shrink-0 z-20 shadow-card border border-white/[0.03] group/sidebar"
    >
      {/* Decorative orange glow */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-10 group-hover/sidebar:opacity-25 bg-orange-500/20 transition-opacity duration-500 blur-3xl pointer-events-none" />
      </div>
      {/* Header */}
      <div className={cn("flex items-center h-16 shrink-0 overflow-hidden transition-all duration-300 relative", collapsed ? "justify-center px-0" : "justify-between px-3")}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div 
              key="logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 shrink-0"
            >
              <img src="/logo.jpg" alt="TGT" className="w-10 h-10 rounded-full object-cover" />
              <span className="text-md font-bold tracking-tight text-text whitespace-nowrap ml-2">
                TGT
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          layout
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-bg-tertiary transition-colors shrink-0",
            collapsed ? "w-11 h-11" : "w-10 h-10"
          )}
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={18} />}
        </motion.button>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4", collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden")}>
        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter(item => allowedModules.includes(item.moduleKey))
          if (visibleItems.length === 0) return null

          const isSectionOpen = section.label ? openSections[section.label] : true

          return (
            <div key={sIdx} className="mt-1 relative group/section">
              {/* Section Header (Expanded or Collapsed) */}
              {section.label && (
                <div 
                  onClick={() => !collapsed && toggleSection(section.label!)}
                  className={cn(
                    "flex items-center h-10 rounded-lg transition-all duration-300 cursor-pointer text-text-secondary hover:text-text",
                    "mx-3 px-3 mb-1 hover:bg-bg-tertiary overflow-hidden",
                    !collapsed && "justify-between"
                  )}
                >
                  {collapsed ? (
                    section.icon ? (
                      <section.icon size={20} className="shrink-0" />
                    ) : (
                      <div className="h-px bg-border w-5 shrink-0" />
                    )
                  ) : (
                    <>
                      <div className="flex items-center gap-3 shrink-0">
                        {section.icon && <section.icon size={20} className="shrink-0 relative z-10" />}
                        <span className="text-sm font-medium relative z-10">
                          {section.label}
                        </span>
                      </div>
                      <ChevronDown size={14} className={cn("transition-transform shrink-0", !isSectionOpen && "-rotate-90")} />
                    </>
                  )}
                </div>
              )}
              
              {/* Floating Menu for Collapsed Sections */}
              {collapsed && section.label && (
                <div className="absolute left-full top-0 py-2 w-48 bg-black dark:bg-white text-white dark:text-black rounded-xl shadow-2xl opacity-0 invisible group-hover/section:opacity-100 group-hover/section:visible transition-all z-[100] pointer-events-none group-hover/section:pointer-events-auto">
                  <div className="px-4 pb-2 mb-2 border-b border-white/10 dark:border-black/10 text-sm font-bold">
                    {section.label}
                  </div>
                  <div className="px-2 space-y-1">
                    {visibleItems.map(item => {
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={true}
                          className={cn(
                            'flex items-center h-9 px-3 gap-3 rounded-lg text-sm font-medium transition-colors',
                            isActive 
                              ? 'bg-white/20 dark:bg-black/10 text-white dark:text-black' 
                              : 'text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black hover:bg-white/10 dark:hover:bg-black/5'
                          )}
                        >
                          <item.icon size={16} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {/* Inline Items for Expanded State or Root Items */}
              <AnimatePresence initial={false}>
                {(!collapsed && isSectionOpen) || (!section.label) ? (
                  <motion.div
                    initial={collapsed || !section.label ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={cn("space-y-1 relative", collapsed ? "overflow-visible" : "overflow-hidden")}
                  >
                    {/* Vertical line for indented items */}
                    {!collapsed && section.label && (
                      <div className="absolute left-[25px] top-1 bottom-1 w-px bg-border/60" />
                    )}
                    
                    {visibleItems.map(item => {
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                      return (
                        <div key={item.href} className="relative group mb-1">
                          <Link
                            href={item.href}
                            prefetch={true}
                            className={cn(
                              'relative flex items-center h-10 rounded-lg transition-all duration-300 shrink-0',
                              'px-3 gap-3 overflow-hidden',
                              collapsed ? 'mx-3' : (section.label ? 'ml-9 mr-3' : 'mx-3'),
                              'hover:bg-bg-tertiary',
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-glow-sm'
                                : (!collapsed && section.label) ? 'text-text-muted hover:text-text-secondary' : 'text-text-secondary hover:text-text'
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active"
                                className="absolute inset-0 rounded-lg bg-primary shadow-glow-sm"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                              />
                            )}
                            <item.icon
                              size={!collapsed && section.label ? 16 : 20}
                              className={cn('shrink-0 relative z-10', isActive ? 'text-primary-foreground' : '')}
                            />
                            <AnimatePresence>
                              {!collapsed && (
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.1 }}
                                  className="text-sm font-medium whitespace-nowrap relative z-10"
                                >
                                  {item.label}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Link>
                          {/* Tooltip when collapsed for root items */}
                          {collapsed && !section.label && (
                            <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%-8px)] px-2.5 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-semibold rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100]">
                              {item.label}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>
    </motion.aside>
  )
}
