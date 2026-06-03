'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TablePaginationProps {
  page: number
  pageSize: number
  total: number
  pageSizes?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  itemLabel?: string
}

export function TablePagination({
  page,
  pageSize,
  total,
  pageSizes = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'rows',
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)

  // Build page number list with ellipsis
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
      acc.push(p)
      return acc
    }, [])

  return (
    <div className="shrink-0 px-4 py-3 border-t border-border bg-bg-tertiary/30 flex items-center justify-between gap-4 flex-wrap">
      {/* Left: count + page size selector */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-text-muted">
          {total === 0 ? `0 ${itemLabel}` : (
            <>
              <span className="font-medium text-text">{from}–{to}</span>
              {' '}of {total} {itemLabel}
            </>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Rows:</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="text-xs bg-bg border border-border rounded-md px-1.5 py-0.5 text-text focus:outline-none focus:border-primary/50 cursor-pointer"
          >
            {pageSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >«</button>

        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        ><ChevronLeft size={14} /></button>

        {pageNumbers.map((item, i) =>
          item === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1 text-xs text-text-muted">…</span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item as number)}
              className={cn(
                'w-7 h-7 rounded-lg text-xs font-medium transition-all',
                safePage === item
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
              )}
            >{item}</button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        ><ChevronRight size={14} /></button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >»</button>
      </div>
    </div>
  )
}
