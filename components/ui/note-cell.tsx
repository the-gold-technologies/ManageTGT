'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NoteCellProps {
  note: string | null | undefined
  maxLength?: number
  className?: string
}

function formatNoteContent(text: string) {
  if (!text) return null;

  return text.split('\n').map((line, lineIndex) => {
    if (!line.trim()) {
      return <div key={lineIndex} className="h-2" />;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = line.split(urlRegex);

    return (
      <div key={lineIndex} className="mb-1 last:mb-0 leading-snug text-xs">
        {parts.map((part, partIndex) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={partIndex}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary bg-primary/5 px-1.5 py-0.5 rounded-md hover:underline font-medium break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }

          let styledPart: React.ReactNode = part;

          if (partIndex === 0) {
            const listMatch = part.match(/^(\d+\.)\s*(.*)/);
            const labelMatch = part.match(/^([A-Za-z0-9\s_-]{2,40}):\s*(.*)/);

            if (listMatch) {
              styledPart = (
                <>
                  <span className="text-text-muted mr-1.5">{listMatch[1]}</span>
                  <span className="font-medium">{listMatch[2]}</span>
                </>
              );
            } else if (labelMatch) {
              styledPart = (
                <>
                  <span className="text-text-muted mr-1">{labelMatch[1]}:</span>
                  <span>{labelMatch[2] ? ` ${labelMatch[2]}` : ''}</span>
                </>
              );
            }
          }

          return <span key={partIndex}>{styledPart}</span>;
        })}
      </div>
    );
  });
}

export function NoteCell({ note, maxLength = 35, className }: NoteCellProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!note) {
    return <span className={cn("text-text-muted text-xs", className)}>—</span>
  }

  const isLong = note.length > maxLength

  return (
    <>
      <div className={cn("flex items-center gap-1.5", className)}>
        <span 
          className="truncate text-xs text-text-secondary" 
          title={!isLong ? note : undefined}
          style={{ maxWidth: '150px' }}
        >
          {note}
        </span>
        {isLong && (
          <button
            onClick={(e) => { 
              e.stopPropagation() 
              setIsOpen(true) 
            }}
            className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
            title="Read full note"
          >
            <FileText size={10} />
            More
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { 
                e.stopPropagation() 
                setIsOpen(false) 
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] !m-0"
            />
            <motion.div
              initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-lg flex flex-col bg-bg-secondary border border-border rounded-2xl z-[101] shadow-2xl overflow-hidden !m-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg/50 shrink-0">
                <div className="flex items-center gap-2 text-text">
                  <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                    <FileText size={16} />
                  </div>
                  <h3 className="font-semibold text-sm">Note Details</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(false)
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="text-text">
                  {formatNoteContent(note)}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
