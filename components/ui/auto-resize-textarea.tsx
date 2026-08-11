'use client'

import React, { useEffect, useRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'

export interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, maxHeight = 300, onChange, value, defaultValue, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null)

    // Expose internalRef to the forwarded ref for react-hook-form
    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

    const adjustHeight = () => {
      const el = internalRef.current
      if (!el) return
      
      // Reset height to auto to calculate the correct scrollHeight
      el.style.height = 'auto'
      
      const newHeight = Math.min(el.scrollHeight, maxHeight)
      el.style.height = `${newHeight}px`
      
      if (el.scrollHeight > maxHeight) {
        el.style.overflowY = 'auto'
      } else {
        el.style.overflowY = 'hidden'
      }
    }

    useEffect(() => {
      adjustHeight()
    }, [value, defaultValue])

    return (
      <textarea
        ref={internalRef}
        value={value}
        defaultValue={defaultValue}
        className={cn(
          "w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none min-h-[80px]",
          className
        )}
        onChange={(e) => {
          adjustHeight()
          if (onChange) onChange(e)
        }}
        {...props}
      />
    )
  }
)

AutoResizeTextarea.displayName = "AutoResizeTextarea"
