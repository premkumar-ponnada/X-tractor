import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './primitives'

export function Modal({ open, onClose, title, description, children, footer, width = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${width} rounded-2xl border border-border bg-surface p-6 shadow-float`}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          >
            <button onClick={onClose} className="absolute top-4 right-4 rounded-lg p-1 text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </button>
            {title ? <h2 className="pr-6 text-lg font-semibold text-fg">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-fg-2">{description}</p> : null}
            {children ? <div className="mt-4">{children}</div> : null}
            {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', danger = false, loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${danger ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'}`}>
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-sm text-fg-2">{description}</p>
        </div>
      </div>
    </Modal>
  )
}
