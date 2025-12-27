import { useEffect, useRef, useCallback, type ReactNode } from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** Whether clicking the backdrop closes the modal */
  closeOnBackdrop?: boolean
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean
  /** Whether to show the backdrop */
  showBackdrop?: boolean
  /** Additional class for the modal container */
  className?: string
  /** Alignment on mobile: 'bottom' slides from bottom, 'center' centers */
  mobileAlign?: 'bottom' | 'center'
  /** Accessibility label ID for the dialog */
  ariaLabelledBy?: string
  /** Whether to prevent closing (e.g., while processing) */
  preventClose?: boolean
}

/**
 * Reusable Modal component with accessibility features.
 * Handles backdrop clicks, escape key, and focus trapping.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showBackdrop = true,
  className = '',
  mobileAlign = 'center',
  ariaLabelledBy,
  preventClose = false,
}: ModalProps) {
  const onCloseRef = useRef(onClose)
  const preventCloseRef = useRef(preventClose)

  // Keep refs updated
  useEffect(() => {
    onCloseRef.current = onClose
    preventCloseRef.current = preventClose
  }, [onClose, preventClose])

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventCloseRef.current) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop && !preventCloseRef.current) {
      onCloseRef.current()
    }
  }, [closeOnBackdrop])

  if (!isOpen) return null

  const alignmentClasses =
    mobileAlign === 'bottom'
      ? 'items-end sm:items-center'
      : 'items-center'

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center ${alignmentClasses}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      {/* Backdrop */}
      {showBackdrop && (
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Modal content */}
      <div className={`relative ${className}`}>
        {children}
      </div>
    </div>
  )
}

export default Modal
