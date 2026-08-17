'use client'

import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  onClick: () => void
}

interface FolderBreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function FolderBreadcrumb({ items, className }: FolderBreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-1 text-sm min-w-0', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={index} className="flex items-center gap-1 min-w-0">
            {index === 0 && (
              <Home size={13} className="text-text-muted shrink-0" />
            )}
            <button
              onClick={item.onClick}
              disabled={isLast}
              className={cn(
                'truncate max-w-[160px] transition-colors',
                isLast
                  ? 'text-text font-medium cursor-default'
                  : 'text-text-muted hover:text-text cursor-pointer'
              )}
            >
              {item.label}
            </button>
            {!isLast && (
              <ChevronRight size={13} className="text-text-muted shrink-0" />
            )}
          </div>
        )
      })}
    </nav>
  )
}
