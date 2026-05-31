"use client"
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, Tooltip, BarChart, Bar } from 'recharts'

interface StatCardProps {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon?: any // Support both LucideIcon and ReactNode
  iconColor?: string
  className?: string
  sparkData?: number[]
  sparkType?: 'area' | 'bar'
  sparkColor?: string
}

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'bg-primary/10 text-primary',
  className,
  sparkData,
  sparkType = 'area',
  sparkColor,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0
  const defaultColor = isPositive ? '#10B981' : '#EF4444'
  const color = sparkColor ?? defaultColor

  const chartData = sparkData?.map((v, i) => ({ v, i })) ?? []

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-bg-secondary border border-border px-4 pb-4 pt-2',
        'hover:border-border-muted transition-all duration-200 group flex flex-col justify-between gap-3',
        className
      )}
    >
      {/* TOP ROW: Icon circle + Title */}
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn(
            'w-5 h-10 rounded-full flex items-center justify-center shrink-0',
            iconColor,
            // ring color matches the icon text color roughly
            'ring-current/20'
          )}>
            {typeof Icon === 'function' || (typeof Icon === 'object' && 'render' in Icon) ? <Icon size={15} /> : Icon}
          </div>
        )}
        <span className="text-sm font-medium text-text-secondary leading-tight">
          {title}
        </span>
      </div>

      {/* BOTTOM ROW: Value+Change on left, Sparkline on right */}
      <div className="flex items-end justify-between gap-4">
        {/* Left: value + change */}
        <div className="min-w-0">
          <div className="text-2xl font-bold text-text tracking-tight leading-none mb-1.5">
            {value}
          </div>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 pt-2">
              <span
                className={cn(
                  'flex items-center gap-1 text-[10px] font-semibold',
                  isPositive ? 'text-success' : 'text-danger'
                )}
              >
                {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {isPositive ? '+' : ''}{change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-text-muted whitespace-nowrap">{changeLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: Sparkline */}
        {chartData.length > 0 && (
          <div className="h-12 w-24 shrink-0 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              {sparkType === 'bar' ? (
                <BarChart data={chartData} barSize={5} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} opacity={0.9} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-bg border border-border rounded-md px-2 py-1 text-xs text-text shadow-xl">
                          {payload[0].value}
                        </div>
                      ) : null
                    }
                  />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`sg-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#sg-${title.replace(/\s+/g, '')})`}
                    dot={false}
                    activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
                  />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-bg border border-border rounded-md px-2 py-1 text-xs text-text shadow-xl">
                          {payload[0].value}
                        </div>
                      ) : null
                    }
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Decorative orange glow */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-20 group-hover:opacity-30 bg-orange-500/20 transition-opacity duration-300 blur-3xl pointer-events-none" />
    </div>
  )
}
