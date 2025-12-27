import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsMounted } from './useIsMounted'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  status: AsyncStatus
  data: T | null
  error: string | null
}

export interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

export interface UseAsyncReturn<T> extends AsyncState<T> {
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  execute: (asyncFn: () => Promise<T>, options?: UseAsyncOptions<T>) => Promise<T | undefined>
  reset: () => void
  setData: (data: T) => void
}

/**
 * Hook for handling async operations with loading/success/error states.
 * Includes protection against memory leaks in unmounted components.
 *
 * @returns State and functions to execute async operations
 *
 * @example
 * const { isLoading, isError, error, execute, reset } = useAsync<OrderResult>()
 *
 * const handleSubmit = () => {
 *   execute(
 *     () => submitOrder(),
 *     {
 *       onSuccess: (data) => {
 *         console.log('Order ID:', data.id)
 *         setTimeout(onClose, 2000)
 *       },
 *       onError: (err) => console.error(err)
 *     }
 *   )
 * }
 */
export function useAsync<T = unknown>(): UseAsyncReturn<T> {
  const { t } = useTranslation()
  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
  })

  const isMounted = useIsMounted()

  const execute = useCallback(
    async (
      asyncFn: () => Promise<T>,
      options?: UseAsyncOptions<T>
    ): Promise<T | undefined> => {
      setState({ status: 'loading', data: null, error: null })

      try {
        const result = await asyncFn()

        if (!isMounted()) return undefined

        setState({ status: 'success', data: result, error: null })
        options?.onSuccess?.(result)
        return result
      } catch (err) {
        if (!isMounted()) return undefined

        const message = err instanceof Error ? err.message : t('errors.unknownError')
        setState({ status: 'error', data: null, error: message })
        options?.onError?.(message)
        return undefined
      }
    },
    [isMounted, t]
  )

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null })
  }, [])

  const setData = useCallback((data: T) => {
    setState({ status: 'success', data, error: null })
  }, [])

  return {
    ...state,
    isIdle: state.status === 'idle',
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    execute,
    reset,
    setData,
  }
}
