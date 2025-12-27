import { useState, useEffect, useCallback } from 'react'
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

  const isMounted = useIsMounted()

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
      }, WAITER_RESPONSE_MIN_MS + Math.random() * WAITER_RESPONSE_VARIANCE_MS)
    } else if (closeStatus === 'waiter_coming') {
      timer = setTimeout(() => {
        if (!isMounted()) return
        setCloseStatus('bill_ready')
      }, BILL_DELIVERY_MIN_MS + Math.random() * BILL_DELIVERY_VARIANCE_MS)
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [closeStatus, isMounted])

  const startCloseFlow = useCallback(async (): Promise<boolean> => {
    setCloseStatus('requesting')
    setError(null)

    // Simulate request submission
    await new Promise((resolve) => setTimeout(resolve, REQUEST_SIMULATION_MS))

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
    // Simulate payment processing for cash/card
    await new Promise((resolve) => setTimeout(resolve, REQUEST_SIMULATION_MS))
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
