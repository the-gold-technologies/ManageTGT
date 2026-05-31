import { cn } from '@/lib/utils'

interface GlowProps {
  className?: string
  position?: 'bottom-right' | 'bottom-left' | 'center'
}

export function Glow({ className, position = 'bottom-right' }: GlowProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none z-0">
      <div 
        className={cn(
          "absolute w-40 h-40 rounded-full opacity-20 group-hover:opacity-30 transition-opacity duration-500 blur-3xl pointer-events-none",
          position === 'bottom-right' ? "-bottom-10 -right-10" : "",
          position === 'bottom-left' ? "-bottom-10 -left-10" : "",
          position === 'center' ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64" : "",
          "bg-orange-500/20",
          className
        )} 
      />
    </div>
  )
}
