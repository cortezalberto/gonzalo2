import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook for debouncing values
 * Useful to avoid excessive calls in search inputs
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const isMountedRef = useRef(true)

  useEffect(() => {
    // Mark as mounted BEFORE creating the timer
    isMountedRef.current = true

    const timer = setTimeout(() => {
      // Only update if component is still mounted
      if (isMountedRef.current) {
        setDebouncedValue(value)
      }
    }, delay)

    return () => {
      // CRITICAL: Clear timer BEFORE marking as unmounted
      // to avoid race condition where timer fires between
      // the isMounted check and setState
      clearTimeout(timer)
      isMountedRef.current = false
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook to create a debounced function
 * Uses useRef to avoid recreating the function on each render
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  const isMountedRef = useRef(true)

  // Sync ref with callback in useEffect (avoids updating ref during render)
  useEffect(() => {
    callbackRef.current = callback
  })

  // Clear timeout on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      // CRITICAL: Clear timer BEFORE marking as unmounted
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      isMountedRef.current = false
    }
  }, [])

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      // Only execute if component is still mounted
      if (isMountedRef.current) {
        callbackRef.current(...args)
      }
    }, delay)
  }, [delay]) as T

  return debouncedCallback
}
