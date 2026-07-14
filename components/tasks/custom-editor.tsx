'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Bold, Italic, Strikethrough, Link as LinkIcon, List, ListOrdered, CheckSquare, Check, X } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

export default function CustomEditor({ value, onChange, disabled }: { value: string, onChange: (val?: string) => void, disabled?: boolean }) {
  const [isSettingLink, setIsSettingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-strong:text-text focus:outline-none min-h-[150px] p-3 bg-bg-secondary text-text',
      },
    },
  })

  // Sync external value changes (like when switching tasks)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) {
    return null
  }

  const startSettingLink = () => {
    const previousUrl = editor.getAttributes('link').href
    setLinkUrl(previousUrl || '')
    setIsSettingLink(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const saveLink = () => {
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    setIsSettingLink(false)
    setLinkUrl('')
  }
  
  const cancelLink = () => {
    setIsSettingLink(false)
    setLinkUrl('')
    editor.commands.focus()
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-bg-secondary">
      <div className="flex items-center gap-1 p-2 border-b border-border bg-bg-tertiary flex-wrap min-h-[44px]">
        {isSettingLink ? (
          <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
            <input
              ref={inputRef}
              type="url"
              placeholder="Paste or type a link..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveLink()
                }
                if (e.key === 'Escape') cancelLink()
              }}
              className="flex-1 px-3 py-1 text-sm bg-bg border border-border rounded-md text-text focus:outline-none focus:border-primary transition-colors h-8"
            />
            <button
              type="button"
              onClick={saveLink}
              className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary-hover transition-colors flex items-center justify-center w-8 h-8 shrink-0"
              title="Save Link"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={cancelLink}
              className="p-1.5 rounded hover:bg-bg-primary text-text-secondary hover:text-text transition-colors flex items-center justify-center w-8 h-8 shrink-0"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('bold') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('italic') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('strike') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={startSettingLink}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('link') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Link"
        >
          <LinkIcon size={16} />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('bulletList') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('orderedList') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-1.5 rounded hover:bg-bg-primary transition-colors ${editor.isActive('taskList') ? 'bg-bg-primary text-primary' : 'text-text-secondary'}`}
          title="Checklist"
        >
          <CheckSquare size={16} />
        </button>
        </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-[300px]">
        <EditorContent editor={editor} className="custom-editor-container" />
      </div>
      <style>{`
        .custom-editor-container .ProseMirror p.is-editor-empty:first-child::before {
          content: 'Add a description...';
          float: left;
          color: #6b7280;
          pointer-events: none;
          height: 0;
        }
        .custom-editor-container ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .custom-editor-container ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .custom-editor-container ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-top: 0.25rem;
          user-select: none;
        }
        .custom-editor-container ul[data-type="taskList"] li > label > input[type="checkbox"] {
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
        .custom-editor-container ul[data-type="taskList"] li > label > input[type="checkbox"]::before {
          content: "";
          width: 4px;
          height: 8px;
          border: solid white;
          border-width: 0 1.5px 1.5px 0;
          transform: scale(0) rotate(45deg);
          transition: 120ms transform ease-in-out;
          margin-top: -2px;
        }
        .custom-editor-container ul[data-type="taskList"] li > label > input[type="checkbox"]:checked {
          background-color: var(--color-primary);
          border-color: var(--color-primary);
        }
        .custom-editor-container ul[data-type="taskList"] li > label > input[type="checkbox"]:checked::before {
          transform: scale(1) rotate(45deg);
        }
        .custom-editor-container ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }
      `}</style>
    </div>
  )
}
