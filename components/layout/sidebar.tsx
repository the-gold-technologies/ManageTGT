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
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'team_lead' | 'team_member' | 'sales_executive'

type NavItem = {
  href: string
  icon: any
  label: string
  roles: Role[]
}

type NavSection = {
  label?: string
  icon?: any
  roles?: Role[]
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'team_lead', 'team_member', 'sales_executive'] },
      { href: '/clients', icon: Users, label: 'Clients', roles: ['admin', 'sales_executive'] },
      { href: '/projects', icon: FolderKanban, label: 'Projects', roles: ['admin', 'team_lead'] },
      { href: '/tasks', icon: CheckSquare, label: 'Tasks', roles: ['admin', 'team_lead', 'team_member'] },
    ]
  },
  {
    label: 'Finance',
    icon: DollarSign,
    roles: ['admin', 'sales_executive'],
    items: [
      { href: '/finance/prospects', icon: Users, label: 'Prospects', roles: ['admin', 'sales_executive'] },
      { href: '/finance/revenue', icon: Receipt, label: 'Revenue', roles: ['admin'] },
      { href: '/finance/expenses', icon: Wallet, label: 'Expenses', roles: ['admin'] },
      { href: '/profitability', icon: TrendingUp, label: 'Profitability', roles: ['admin'] },
    ]
  },
  {
    label: 'Growth',
    icon: TrendingUp,
    roles: ['admin', 'sales_executive'],
    items: [
      { href: '/targets', icon: Target, label: 'Sales Targets', roles: ['admin', 'sales_executive'] },
      { href: '/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin'] },
    ]
  },
  {
    label: 'System',
    icon: Settings,
    roles: ['admin', 'team_lead', 'team_member', 'sales_executive'],
    items: [
      { href: '/team', icon: UserCog, label: 'Team', roles: ['admin', 'team_lead'] },
      { href: '/activity', icon: Clock, label: 'Activity Logs', roles: ['admin', 'team_lead'] },
      { href: '/settings', icon: Settings, label: 'Settings', roles: ['admin', 'team_lead', 'team_member', 'sales_executive'] },
    ]
  }
]

interface SidebarProps {
  userRole?: string
}

export default function Sidebar({ userRole = 'admin' }: SidebarProps) {
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
      <div className={cn("flex items-center h-16 shrink-0 pl-3 overflow-hidden transition-all duration-200", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2.5 shrink-0"
          >
            <img src="/logo.jpg" alt="TGT" className="w-10 h-10 rounded-full object-cover" />
            <span className="text-md font-bold tracking-tight text-text whitespace-nowrap ml-2">
              TGT
            </span>
          </motion.div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-bg-tertiary transition-colors shrink-0",
            collapsed ? "w-11 h-11" : "w-10 h-10"
          )}
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {NAV_SECTIONS.map((section, sIdx) => {
          const hasVisibleItems = section.items.some(item => item.roles.includes(userRole as Role))
          const sectionRoleAllowed = section.roles ? section.roles.includes(userRole as Role) : true
          
          if (!hasVisibleItems || !sectionRoleAllowed) return null

          const isSectionOpen = section.label ? openSections[section.label] : true

          return (
            <div key={sIdx} className="mt-1 relative group/section">
              {/* Section Header (Expanded or Collapsed) */}
              {section.label && (
                <div 
                  onClick={() => !collapsed && toggleSection(section.label!)}
                  className={cn(
                    "flex items-center h-10 rounded-lg transition-all duration-200 cursor-pointer text-text-secondary hover:text-text",
                    collapsed ? 'w-10 mx-auto justify-center hover:bg-bg-tertiary mb-1' : 'justify-between px-3 mx-3 mb-1 hover:bg-bg-tertiary'
                  )}
                >
                  {collapsed ? (
                    section.icon ? (
                      <section.icon size={20} className="shrink-0" />
                    ) : (
                      <div className="h-px bg-border mx-auto w-6" />
                    )
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        {section.icon && <section.icon size={20} className="shrink-0 relative z-10" />}
                        <span className="text-sm font-medium relative z-10">
                          {section.label}
                        </span>
                      </div>
                      <ChevronDown size={14} className={cn("transition-transform", !isSectionOpen && "-rotate-90")} />
                    </>
                  )}
                </div>
              )}
              
              {/* Floating Menu for Collapsed Sections */}
              {collapsed && section.label && (
                <div className="absolute left-full top-0 ml-2 py-2 w-48 bg-bg-secondary border border-border rounded-xl shadow-card opacity-0 invisible group-hover/section:opacity-100 group-hover/section:visible transition-all z-50 pointer-events-none group-hover/section:pointer-events-auto">
                  <div className="px-4 pb-2 mb-2 border-b border-border text-sm font-bold text-text">
                    {section.label}
                  </div>
                  <div className="px-2 space-y-1">
                    {section.items.filter(item => item.roles.includes(userRole as Role)).map(item => {
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center h-9 px-3 gap-3 rounded-lg text-sm font-medium transition-colors',
                            isActive ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
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
                    className="overflow-hidden space-y-1 relative"
                  >
                    {/* Vertical line for indented items */}
                    {!collapsed && section.label && (
                      <div className="absolute left-[25px] top-1 bottom-1 w-px bg-border/60" />
                    )}
                    
                    {section.items.filter(item => item.roles.includes(userRole as Role)).map(item => {
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'group relative flex items-center h-10 rounded-lg transition-all duration-200 shrink-0 mb-1',
                            collapsed ? 'w-10 mx-auto justify-center px-0 overflow-visible' : 'mx-3 px-3 gap-3 overflow-hidden',
                            !collapsed && section.label && 'ml-9 px-3', // indent if in a section
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
                          {/* Tooltip when collapsed for root items */}
                          {collapsed && !section.label && (
                            <div className="absolute left-full ml-2 px-2 py-1 bg-bg-secondary text-text text-xs rounded-md border border-border whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-card">
                              {item.label}
                            </div>
                          )}
                        </Link>
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
