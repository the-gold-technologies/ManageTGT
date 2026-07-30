import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Smile, Send, Mic, X, Loader2, Image as ImageIcon } from 'lucide-react'

interface MessageInputProps {
  input: string
  setInput: (val: string) => void
  handleSend: (e: React.FormEvent) => void
  isTyping: boolean
  isUploading: boolean
  pendingFile: { file: File, name: string, type: string, url: string } | null
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  setPendingFile: (file: any) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  replyingToMsg: any | null
  onCancelReply: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
}

export function MessageInput({
  input,
  setInput,
  handleSend,
  isTyping,
  isUploading,
  pendingFile,
  handleFileSelect,
  setPendingFile,
  textareaRef,
  fileInputRef,
  replyingToMsg,
  onCancelReply,
  onKeyDown,
  onFocus
}: MessageInputProps) {
  
  const hasContent = input.trim().length > 0 || !!pendingFile

  return (
    <div className="bg-transparent p-2 md:p-3 pb-3 flex flex-col z-20 shrink-0">
      
      {/* Reply Preview Bar */}
      <AnimatePresence>
        {replyingToMsg && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 bg-bg border-l-4 border-primary rounded-lg p-2 flex items-start justify-between shadow-sm overflow-hidden"
          >
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-primary text-[12px] font-bold block mb-0.5">
                Replying to {replyingToMsg.sender?.name || 'User'}
              </span>
              <p className="text-text text-[13px] truncate">
                {replyingToMsg.content?.replace(/[@#]\[([^\]]+)\]\([^)]+\)/g, (match: string, p1: string) => match.startsWith('@') ? `@${p1}` : `#${p1}`)}
              </p>
            </div>
            <button 
              onClick={onCancelReply}
              className="p-1 hover:bg-bg-tertiary rounded-full text-text-muted transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment Preview Bar */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 bg-bg rounded-lg p-2 flex items-center gap-3 shadow-sm border border-border overflow-hidden relative"
          >
            <div className="w-12 h-12 bg-bg-tertiary rounded-md flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
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

      {/* Main Input Row */}
      <div className="flex items-end relative w-full max-w-4xl mx-auto">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
        />
        
        <div className="flex-1 bg-bg border border-border rounded-[24px] flex items-end px-1 py-1 min-h-[48px] focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
          <div className="flex items-center pb-2 h-[36px] shrink-0 pl-1">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-text-muted hover:text-text rounded-full transition-colors"
            >
              <Paperclip size={22} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none focus:border-0 focus:border-transparent resize-none max-h-20 text-[14px] leading-relaxed custom-scrollbar py-3 px-2 self-center !border-0 !ring-0 !outline-none focus:!ring-0 focus:!outline-none"
            rows={1}
            style={{ height: 'auto', boxShadow: 'none' }}
          />

          <div className="flex items-center pb-1 h-[40px] shrink-0 pr-1 w-10 justify-center">
            <AnimatePresence>
              {hasContent && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={handleSend}
                  disabled={isUploading}
                  className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors shrink-0 shadow-glow-sm"
                >
                  <Send size={14} className="ml-0.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
