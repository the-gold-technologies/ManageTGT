'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  PanelLeftClose,
  PanelLeft,
  Activity,
  Shield,
  CreditCard,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SuperadminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: '/superadmin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/superadmin/organizations', icon: Users, label: 'Organizations' },
    { href: '#analytics', icon: Activity, label: 'Platform Analytics' },
    { href: '#users', icon: Shield, label: 'Global Users' },
    { href: '#billing', icon: CreditCard, label: 'Billing' },
    { href: '/superadmin/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 220 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-[calc(100vh-1.5rem)] my-3 ml-2 bg-bg-secondary rounded-2xl shrink-0 z-20 shadow-card border border-white/[0.03] group/sidebar"
    >
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-10 group-hover/sidebar:opacity-25 bg-blue-500/20 transition-opacity duration-500 blur-3xl pointer-events-none" />
      </div>

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
                Platform Admin
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

      <nav className={cn("flex-1 py-4", collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden")}>
        <div className="mt-1 relative group/section space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <div key={item.href} className="relative group mb-1">
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex items-center h-10 rounded-lg transition-all duration-300 shrink-0 px-3 gap-3 mx-3 overflow-hidden hover:bg-bg-tertiary',
                    isActive ? 'bg-primary text-primary-foreground shadow-glow-sm' : 'text-text-secondary hover:text-text'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sa-sidebar-active"
                      className="absolute inset-0 rounded-lg bg-primary shadow-glow-sm"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <item.icon size={20} className={cn('shrink-0 relative z-10', isActive ? 'text-primary-foreground' : '')} />
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
                {collapsed && (
                  <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%-8px)] px-2.5 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs font-semibold rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100]">
                    {item.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>
    </motion.aside>
  )
}
