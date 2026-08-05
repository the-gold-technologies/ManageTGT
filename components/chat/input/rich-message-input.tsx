'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon,
  List, ListOrdered, Code, CodeSquare, Paperclip, Smile, AtSign,
  Send, X, Loader2, Image as ImageIcon, Type, Plus
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { EmojiPicker } from './emoji-picker'

interface RichMessageInputProps {
  onSend: (html: string, plainText: string) => void
  channelName?: string
  isUploading: boolean
  pendingFile: { file: File; name: string; type: string; url: string } | null
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  setPendingFile: (file: any) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  replyingToMsg: any | null
  onCancelReply: () => void
  editingMessage?: { id: string; content: string } | null
  onCancelEdit?: () => void
  onMentionTrigger?: (type: 'user' | 'task', query: string) => void
  onMentionClose?: () => void
  disabled?: boolean
}

export function RichMessageInput({
  onSend,
  channelName = 'message',
  isUploading,
  pendingFile,
  handleFileSelect,
  setPendingFile,
  fileInputRef,
  replyingToMsg,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onMentionTrigger,
  onMentionClose,
  disabled = false
}: RichMessageInputProps) {
  const [showToolbar, setShowToolbar] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiButtonRef = React.useRef<HTMLButtonElement>(null)
  const [emojiPos, setEmojiPos] = useState<{ top?: number, bottom?: number, left: number }>({ left: 0 })

  const handleOpenEmoji = () => {
    if (emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect()
      // Emoji picker is ~420px tall. If there isn't enough space below, force it above.
      const shouldOpenUpwards = rect.bottom + 430 > window.innerHeight
      setEmojiPos({
        bottom: shouldOpenUpwards ? window.innerHeight - rect.top + 4 : undefined,
        top: shouldOpenUpwards ? undefined : rect.bottom + 4,
        left: rect.left
      })
    }
    setShowEmojiPicker(!showEmojiPicker)
  }

  // Hide emoji picker on scroll
  React.useEffect(() => {
    if (showEmojiPicker) {
      let isActive = false
      const timer = setTimeout(() => { isActive = true }, 150)
      const handleScroll = (e: Event) => {
        if (!isActive) return
        const target = e.target as HTMLElement
        if (target && target.closest('.emoji-picker-container')) {
          return
        }
        setShowEmojiPicker(false)
      }
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [showEmojiPicker])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: {
            class: 'chat-code-block',
          },
        },
        code: {
          HTMLAttributes: {
            class: 'chat-inline-code',
          },
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'chat-link',
        },
      }),
      Placeholder.configure({
        placeholder: `Message ${channelName ? '#' + channelName : ''}`,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'chat-editor-content',
      },
      handleKeyDown(view, event) {
        // Enter to send (without shift)
        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          // Don't send if in a code block or list
          const { state } = view
          const { $from } = state.selection
          const nodeType = $from.parent.type.name
          if (nodeType === 'codeBlock' || nodeType === 'listItem' || nodeType === 'taskItem') {
            return false
          }
          event.preventDefault()
          handleSend()
          return true
        }
        return false
      },
    },
    content: editingMessage?.content || '',
    onUpdate({ editor }) {
      // Handle mention detection
      const text = editor.getText()
      const cursorPos = editor.state.selection.$from.pos
      const textBeforeCursor = text.slice(0, cursorPos)
      const mentionMatch = textBeforeCursor.match(/(?:^|\s)([@#])([\w\s-]*)$/)
      
      if (mentionMatch) {
        const type = mentionMatch[1] === '@' ? 'user' : 'task'
        onMentionTrigger?.(type, mentionMatch[2])
      } else {
        onMentionClose?.()
      }
    },
  })

  // Update editor content when editing mode changes
  useEffect(() => {
    if (editor && editingMessage) {
      editor.commands.setContent(editingMessage.content)
      editor.commands.focus('end')
    }
  }, [editor, editingMessage])

  // Focus editor when reply is triggered
  useEffect(() => {
    if (replyingToMsg && editor) {
      editor.commands.focus()
    }
  }, [replyingToMsg, editor])

  const handleSend = useCallback(() => {
    if (!editor) return
    const html = editor.getHTML()
    const text = editor.getText().trim()
    
    if (!text && !pendingFile) return
    
    onSend(html, text)
    editor.commands.clearContent()
    setShowToolbar(false)
  }, [editor, onSend, pendingFile])

  const handleInsertEmoji = (emoji: string) => {
    if (!editor) return
    editor.commands.insertContent(emoji)
    editor.commands.focus()
    setShowEmojiPicker(false)
  }

  const handleAddLink = () => {
    if (!editor) return
    const url = window.prompt('Enter URL')
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const hasContent = editor ? editor.getText().trim().length > 0 : false
  const canSend = hasContent || !!pendingFile

  if (!editor) return null

  return (
    <div className="bg-transparent px-2 md:px-3 pt-2 pb-3 flex flex-col z-20 shrink-0">
      {/* Edit Mode Banner */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 bg-warning/10 border-l-4 border-warning rounded-lg p-2.5 flex items-center justify-between overflow-hidden"
          >
            <div className="flex-1 min-w-0">
              <span className="text-warning text-[12px] font-bold block">Editing message</span>
            </div>
            <button onClick={onCancelEdit} className="p-1 hover:bg-bg-tertiary rounded-full text-text-muted transition-colors shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Preview Bar */}
      <AnimatePresence>
        {replyingToMsg && !editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 bg-bg border-l-4 border-primary rounded-lg p-2.5 flex items-start justify-between shadow-sm overflow-hidden"
          >
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-primary text-[12px] font-bold block mb-0.5">
                Replying to {replyingToMsg.sender?.name || 'User'}
              </span>
              <p className="text-text text-[13px] truncate">
                {replyingToMsg.content?.replace(/<[^>]*>/g, '').replace(/[@#]\[([^\]]+)\]\([^)]+\)/g, (_: string, p1: string) => `@${p1}`)}
              </p>
            </div>
            <button onClick={onCancelReply} className="p-1 hover:bg-bg-tertiary rounded-full text-text-muted transition-colors shrink-0">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment Preview */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 bg-bg rounded-lg p-2.5 flex items-center gap-3 shadow-sm border border-border overflow-hidden relative"
          >
            <div className="w-12 h-12 bg-bg-tertiary rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border">
              {pendingFile.type.startsWith('image/') ? (
                <img src={pendingFile.url} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-text-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text truncate">{pendingFile.name}</p>
              <p className="text-[11px] text-text-muted">{(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              onClick={() => {
                setPendingFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="p-1.5 hover:bg-bg-tertiary rounded-full text-text-muted transition-colors"
            >
              <X size={18} />
            </button>
            {isUploading && (
              <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 className="animate-spin text-primary" size={20} />
                <span className="text-xs font-medium text-text ml-2">Uploading...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Area */}
      <div className="flex flex-col w-full max-w-4xl mx-auto">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

        <div className="bg-bg-secondary border border-border-muted rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
          {/* Formatting Toolbar (collapsible) */}
          <AnimatePresence>
            {showToolbar && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="border-b border-border overflow-hidden"
              >
                <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap">
                  <ToolbarButton
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold (Ctrl+B)"
                  >
                    <Bold size={16} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic (Ctrl+I)"
                  >
                    <Italic size={16} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor.isActive('underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title="Underline (Ctrl+U)"
                  >
                    <UnderlineIcon size={16} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor.isActive('strike')}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                  >
                    <Strikethrough size={16} />
                  </ToolbarButton>

                  <div className="w-px h-5 bg-border mx-1" />

                  <ToolbarButton
                    active={false}
                    onClick={handleAddLink}
                    title="Add link"
                  >
                    <LinkIcon size={16} />
                  </ToolbarButton>

                  <div className="w-px h-5 bg-border mx-1" />

                  <ToolbarButton
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet list"
                  >
                    <List size={16} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered list"
                  >
                    <ListOrdered size={16} />
                  </ToolbarButton>

                  <div className="w-px h-5 bg-border mx-1" />

                  <ToolbarButton
                    active={editor.isActive('code')}
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    title="Inline code"
                  >
                    <Code size={16} />
                  </ToolbarButton>
                  <ToolbarButton
                    active={editor.isActive('codeBlock')}
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    title="Code block"
                  >
                    <CodeSquare size={16} />
                  </ToolbarButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editor Area */}
          <div className="px-3 py-2 min-h-[44px] max-h-[200px] overflow-y-auto custom-scrollbar">
            <EditorContent editor={editor} />
          </div>

          {/* Bottom Action Row */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-border">
            <div className="flex items-center gap-0.5">
              {/* Attachment */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
                title="Attach file"
              >
                <Plus size={18} />
              </button>

              {/* Toggle Formatting */}
              <button
                onClick={() => setShowToolbar(!showToolbar)}
                className={`p-1.5 rounded-md transition-colors ${showToolbar ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-text hover:bg-bg-tertiary'}`}
                title="Formatting"
              >
                <Type size={18} />
              </button>

              {/* Emoji Picker */}
              <div className="relative">
                <button
                  ref={emojiButtonRef}
                  onClick={handleOpenEmoji}
                  className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
                  title="Emoji"
                >
                  <Smile size={18} />
                </button>
                {typeof window !== 'undefined' && createPortal(
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <div
                        className="emoji-picker-container"
                        style={{
                          position: 'fixed',
                          top: emojiPos.top,
                          bottom: emojiPos.bottom,
                          left: emojiPos.left,
                          zIndex: 110,
                        }}
                      >
                        <EmojiPicker
                          onSelect={handleInsertEmoji}
                          onClose={() => setShowEmojiPicker(false)}
                          position="top"
                          isPortaled={true}
                        />
                      </div>
                    )}
                  </AnimatePresence>,
                  document.body
                )}
              </div>

              {/* @ Mention */}
              <button
                onClick={() => {
                  editor.commands.insertContent('@')
                  editor.commands.focus()
                }}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
                title="Mention someone"
              >
                <AtSign size={18} />
              </button>
            </div>

            {/* Send Button */}
            <div className="flex items-center gap-1">
              {(editingMessage) && (
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1.5 text-[12px] font-medium text-text-muted hover:text-text rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
              )}
              <AnimatePresence>
                {canSend && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleSend}
                    disabled={isUploading || disabled}
                    className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-all disabled:opacity-50 shadow-sm"
                    title={editingMessage ? 'Save edit' : 'Send message'}
                  >
                    <Send size={15} className="ml-0.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Toolbar Button Component
function ToolbarButton({
  active,
  onClick,
  title,
  children
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
      }`}
    >
      {children}
    </button>
  )
}
