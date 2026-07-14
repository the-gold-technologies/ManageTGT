'use client'

import { useRef, useState, useEffect } from 'react'

export default function CardMarkdownPreview({ source, onUpdate }: { source: string, onUpdate?: (newSource: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [localSource, setLocalSource] = useState(source)

  // Sync external changes
  useEffect(() => {
    setLocalSource(source)
  }, [source])

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      e.stopPropagation()
      
      if (!onUpdate || !containerRef.current) return
      
      // Update DOM visually first
      const li = target.closest('li')
      if (li) {
        const isChecked = (target as HTMLInputElement).checked
        li.setAttribute('data-checked', isChecked ? 'true' : 'false')
        if (isChecked) {
          target.setAttribute('checked', 'checked')
        } else {
          target.removeAttribute('checked')
        }
        
        const newHtml = containerRef.current.innerHTML
        // Optimistically update local state so it doesn't flicker back to unchecked
        setLocalSource(newHtml)
        // Save the updated HTML
        onUpdate(newHtml)
      }
    } else if (target.tagName === 'A') {
      e.stopPropagation()
    }
  }

  return (
    <>
      <style>{`
        .markdown-preview-container ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .markdown-preview-container ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .markdown-preview-container ul[data-type="taskList"] li > label > input[type="checkbox"] {
          appearance: none;
          background-color: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          width: 14px;
          height: 14px;
          border-radius: 3px;
          display: grid;
          place-content: center;
          cursor: pointer;
          margin: 0;
        }
        .markdown-preview-container ul[data-type="taskList"] li > label > input[type="checkbox"]::before {
          content: "";
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 1.9px 1.9px 0;
          transform: scale(0) rotate(45deg);
          transition: 120ms transform ease-in-out;
          margin-top: -2px;
        }
        .markdown-preview-container ul[data-type="taskList"] li > label > input[type="checkbox"]:checked {
          background-color: var(--color-primary);
          border-color: var(--color-primary);
        }
        .markdown-preview-container ul[data-type="taskList"] li > label > input[type="checkbox"]:checked::before {
          transform: scale(1) rotate(45deg);
        }
        .markdown-preview-container ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-top: 0.1rem;
          cursor: pointer;
        }
        .markdown-preview-container ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }
      `}</style>
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="markdown-preview-container text-[11px] text-text-secondary mb-3 leading-tight prose prose-sm dark:prose-invert prose-p:my-0.5 prose-p:leading-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-text"
        dangerouslySetInnerHTML={{ __html: localSource }}
        style={{ fontSize: '11px' }}
      />
    </>
  )
}
