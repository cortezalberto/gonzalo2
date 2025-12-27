/**
 * Google Sign-In Button Component
 *
 * Renders either the Google Identity Services button or a fallback button
 * that triggers the Google Sign-In flow.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore, useAuthState, useAuthActions } from '../stores/authStore'
import { renderGoogleButton, isGoogleAuthConfigured } from '../services/googleAuth'
import LoadingSpinner from './ui/LoadingSpinner'
import { googleAuthLogger } from '../utils/logger'

// Counter to generate unique IDs without using Math.random in render
let buttonIdCounter = 0
function generateButtonId(): string {
  return `google-signin-${++buttonIdCounter}`
}

interface GoogleSignInButtonProps {
  /** Called after successful sign-in */
  onSuccess?: () => void
  /** Called on error */
  onError?: (error: string) => void
  /** Button text variant */
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  /** Button theme */
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  /** Button size */
  size?: 'large' | 'medium' | 'small'
  /** Button width in pixels */
  width?: number
  /** Show loading state */
  showLoading?: boolean
  /** Additional CSS classes */
  className?: string
}

export default function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
  theme = 'filled_black',
  size = 'large',
  width = 300,
  showLoading = true,
  className = '',
}: GoogleSignInButtonProps) {
  const { t, i18n } = useTranslation()
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  // Generate stable ID using useMemo with pure function
  const buttonId = useMemo(() => generateButtonId(), [])
  const [useNativeButton, setUseNativeButton] = useState(false)
  const [buttonRendered, setButtonRendered] = useState(false)

  const { isLoading, error, isAuthenticated } = useAuthState()
  const { initialize, signInWithGoogle, clearError } = useAuthActions()
  const isInitialized = useAuthStore((state) => state.isInitialized)

  // Track if user was authenticated on mount (from localStorage)
  // This prevents firing onSuccess when component mounts with existing auth
  const wasAuthenticatedOnMountRef = useRef(isAuthenticated)
  const hasCalledSuccessRef = useRef(false)

  // Use refs for callbacks to avoid stale closures in effects
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)

  // Keep refs in sync with latest props
  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  }, [onSuccess, onError])

  // Initialize auth on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Render Google button when initialized
  useEffect(() => {
    if (!isInitialized || !isGoogleAuthConfigured() || buttonRendered) {
      return
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        renderGoogleButton(buttonId, {
          theme,
          size,
          text,
          width,
          locale: i18n.language,
        })
        setButtonRendered(true)
      } catch (error) {
        googleAuthLogger.warn('Failed to render Google button, using fallback:', error)
        setUseNativeButton(true)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isInitialized, theme, size, text, width, buttonRendered, buttonId, i18n.language])

  // Handle success - only fire when user JUST authenticated (not on mount with existing auth)
  useEffect(() => {
    // Skip if:
    // 1. Not authenticated
    // 2. No onSuccess callback (check ref to avoid stale closure)
    // 3. Already called success for this session
    // 4. Was already authenticated when component mounted (from localStorage)
    if (!isAuthenticated || !onSuccessRef.current || hasCalledSuccessRef.current) {
      return
    }

    // If user was already authenticated on mount, don't fire onSuccess
    // This prevents auto-join when navigating back to JoinTable
    if (wasAuthenticatedOnMountRef.current) {
      return
    }

    // User just authenticated - fire callback once
    hasCalledSuccessRef.current = true
    onSuccessRef.current()
  }, [isAuthenticated]) // Only depend on isAuthenticated, callback accessed via ref

  // Handle error
  useEffect(() => {
    if (error && onErrorRef.current) {
      onErrorRef.current(error)
    }
  }, [error]) // Only depend on error, callback accessed via ref

  // Handle fallback button click
  const handleFallbackClick = useCallback(async () => {
    clearError()
    try {
      await signInWithGoogle()
    } catch {
      // Error is handled by the authStore
    }
  }, [signInWithGoogle, clearError])

  // Check if Google OAuth is configured
  if (!isGoogleAuthConfigured()) {
    return (
      <div className={`text-center ${className}`}>
        <p className="text-dark-muted text-sm">
          {t('google.notConfigured')}
        </p>
      </div>
    )
  }

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className={`flex justify-center ${className}`}>
        <div className="w-[300px] h-[44px] bg-dark-elevated rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Google's rendered button */}
      <div
        id={buttonId}
        ref={buttonContainerRef}
        className={`flex justify-center ${useNativeButton ? 'hidden' : ''}`}
      />

      {/* Fallback button if Google's button fails to render */}
      {useNativeButton && (
        <button
          onClick={handleFallbackClick}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-medium py-3 px-4 rounded-xl border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ width: width ? `${width}px` : '100%' }}
        >
          {isLoading && showLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <GoogleIcon />
              <span>
                {text === 'signin_with' && t('google.signInWith')}
                {text === 'signup_with' && t('google.signUpWith')}
                {text === 'continue_with' && t('google.continueWith')}
                {text === 'signin' && t('google.signIn')}
              </span>
            </>
          )}
        </button>
      )}

      {/* Loading overlay */}
      {isLoading && showLoading && !useNativeButton && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/50 rounded-lg">
          <LoadingSpinner />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-red-400 text-sm text-center">
          {error}
        </p>
      )}
    </div>
  )
}

// Google "G" icon
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

