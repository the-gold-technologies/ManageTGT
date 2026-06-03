'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './button'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  loading = false
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl z-10 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 mt-1">
                  <h3 className="font-semibold text-text mb-1.5">{title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-bg border-t border-border mt-2">
              <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
                {cancelText}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                loading={loading}
                variant={isDestructive ? 'danger' : 'primary'}
                className={isDestructive ? 'bg-danger text-white hover:bg-danger/90 border-danger' : ''}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
