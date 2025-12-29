import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMounted } from './useIsMounted'
import { MOCK_WAITERS } from '../constants'

// Transition timing constants (ms)
const WAITER_RESPONSE_MIN_MS = 2000
const WAITER_RESPONSE_VARIANCE_MS = 2000
const BILL_DELIVERY_MIN_MS = 3000
const BILL_DELIVERY_VARIANCE_MS = 2000
const REQUEST_SIMULATION_MS = 1500

export type CloseStatus =
  | 'idle'
  | 'requesting'
  | 'waiting'
  | 'waiter_coming'
  | 'bill_ready'
  | 'processing_payment'
  | 'paid'

export type PaymentMethod = 'card' | 'cash' | 'mercadopago'

interface WaiterInfo {
  name: string
  estimatedTime: number
}

interface UseCloseTableFlowReturn {
  closeStatus: CloseStatus
  waiterName: string
  estimatedTime: number
  error: string | null
  isProcessing: boolean
  startCloseFlow: () => Promise<boolean>
  confirmPayment: (method: PaymentMethod) => Promise<void>
  setError: (error: string | null) => void
}

/**
 * Hook to manage the table closing flow with simulated states.
 * Manages transition: requesting → waiting → waiter_coming → bill_ready → paid
 */
export function useCloseTableFlow(
  closeTable: () => Promise<{ success: boolean; error?: string }>
): UseCloseTableFlowReturn {
  const [closeStatus, setCloseStatus] = useState<CloseStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [waiterInfo, setWaiterInfo] = useState<WaiterInfo>({ name: '', estimatedTime: 0 })

  // MEMORY LEAK FIX: Track all active timers for comprehensive cleanup
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const isMounted = useIsMounted()

  // MEMORY LEAK FIX: Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  // Simulation of automatic state transitions
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (closeStatus === 'waiting') {
      timer = setTimeout(() => {
        if (!isMounted()) return
        setWaiterInfo({
          name: MOCK_WAITERS[Math.floor(Math.random() * MOCK_WAITERS.length)],
          estimatedTime: Math.floor(Math.random() * 2) + 1,
        })
        setCloseStatus('waiter_coming')
        // MEMORY LEAK FIX: Remove from tracked timers after execution
        if (timer) timersRef.current.delete(timer)
      }, WAITER_RESPONSE_MIN_MS + Math.random() * WAITER_RESPONSE_VARIANCE_MS)
      // MEMORY LEAK FIX: Track timer for comprehensive cleanup
      timersRef.current.add(timer)
    } else if (closeStatus === 'waiter_coming') {
      timer = setTimeout(() => {
        if (!isMounted()) return
        setCloseStatus('bill_ready')
        // MEMORY LEAK FIX: Remove from tracked timers after execution
        if (timer) timersRef.current.delete(timer)
      }, BILL_DELIVERY_MIN_MS + Math.random() * BILL_DELIVERY_VARIANCE_MS)
      // MEMORY LEAK FIX: Track timer for comprehensive cleanup
      timersRef.current.add(timer)
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
        // MEMORY LEAK FIX: Remove from tracked timers on cleanup
        timersRef.current.delete(timer)
      }
    }
  }, [closeStatus, isMounted])

  const startCloseFlow = useCallback(async (): Promise<boolean> => {
    setCloseStatus('requesting')
    setError(null)

    // MEMORY LEAK FIX: Track timer and use promise pattern for cleanup
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        resolve()
      }, REQUEST_SIMULATION_MS)
      timersRef.current.add(timer)
    })

    if (!isMounted()) return false

    const result = await closeTable()

    if (!isMounted()) return false

    if (result.success) {
      setCloseStatus('waiting')
      return true
    } else {
      setError(result.error || 'Error closing table')
      setCloseStatus('idle')
      return false
    }
  }, [closeTable, isMounted])

  const confirmPayment = useCallback(async (method: PaymentMethod): Promise<void> => {
    // For Mercado Pago, the redirect is handled in the component
    // This is called for cash or card payments
    if (method === 'mercadopago') {
      // Payment is handled by redirect in CloseStatusView
      return
    }

    setCloseStatus('processing_payment')

    // MEMORY LEAK FIX: Track timer for payment simulation
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        resolve()
      }, REQUEST_SIMULATION_MS)
      timersRef.current.add(timer)
    })

    if (!isMounted()) return
    setCloseStatus('paid')
  }, [isMounted])

  const isProcessing = closeStatus !== 'idle' && closeStatus !== 'paid'

  return {
    closeStatus,
    waiterName: waiterInfo.name,
    estimatedTime: waiterInfo.estimatedTime,
    error,
    isProcessing,
    startCloseFlow,
    confirmPayment,
    setError,
  }
}
