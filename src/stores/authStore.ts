/**
 * Authentication Store
 *
 * Manages user authentication state using Google OAuth.
 * Uses sessionStorage for tokens (more secure than localStorage).
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthUser, GoogleCredentialResponse } from '../types'
import {
  initializeGoogleAuth,
  promptGoogleSignIn,
  disableAutoSelect,
  cancelGoogleSignIn,
  isGoogleAuthConfigured,
  verifyNonce,
  clearNonce,
} from '../services/googleAuth'
import { authStoreLogger } from '../utils/logger'
import { AuthError } from '../utils/errors'

// Mock mode: decode Google JWT directly without backend
// In production, set VITE_MOCK_AUTH=false to use backend verification
const MOCK_MODE = import.meta.env.VITE_MOCK_AUTH !== 'false' && import.meta.env.DEV

// Token expiration buffer (5 minutes before actual expiry)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

/**
 * Decode a JWT token payload (without verification - for mock mode only)
 * In production, the backend would verify the token signature
 *
 * SECURITY NOTE: This is only safe because Google signs the token.
 * The backend MUST verify the signature in production mode.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null // JWT must have 3 parts

    const base64Url = parts[1]
    if (!base64Url) return null

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Check if a JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') {
    return true // Treat invalid tokens as expired
  }

  const expiryTime = payload.exp * 1000 // Convert to milliseconds
  const now = Date.now()

  // Consider expired if within buffer time of expiry
  return now >= expiryTime - TOKEN_EXPIRY_BUFFER_MS
}

/**
 * Validate required fields in JWT payload
 */
function validateJwtPayload(payload: Record<string, unknown>): boolean {
  // Required Google JWT fields
  const requiredFields = ['sub', 'email', 'name']
  return requiredFields.every(field =>
    typeof payload[field] === 'string' && payload[field] !== ''
  )
}

// AuthError is now imported from utils/errors

/**
 * Process mock mode authentication (decode JWT directly without backend)
 * Used for local development when backend is not available
 */
function processMockAuth(credential: string): AuthUser {
  const payload = decodeJwtPayload(credential)

  if (!payload) {
    throw new AuthError('Invalid Google token', 'errors.authGoogleInvalid')
  }

  // Validate CSRF nonce to prevent replay attacks
  if (!verifyNonce(credential)) {
    throw new AuthError('Security error: invalid token', 'errors.authSecurityError')
  }

  // Clear nonce after successful verification
  clearNonce()

  // Validate required fields
  if (!validateJwtPayload(payload)) {
    throw new AuthError('Incomplete Google token', 'errors.authGoogleIncomplete')
  }

  // Check token expiration
  if (isTokenExpired(credential)) {
    throw new AuthError('Expired Google token', 'errors.authGoogleExpired')
  }

  // Extract user info from Google JWT payload
  return {
    id: payload.sub as string,
    email: payload.email as string,
    full_name: payload.name as string,
    picture: payload.picture as string | undefined,
    is_verified: Boolean(payload.email_verified),
    role: 'diner',
    created_at: new Date().toISOString(),
  }
}

/**
 * Result from production auth API call
 */
interface ProductionAuthResult {
  user: AuthUser
  accessToken: string
  refreshToken: string | null
}

// Production auth configuration
const PRODUCTION_AUTH_CONFIG = {
  timeout: 30000, // 30 seconds
  maxRetries: 2,
  retryDelay: 1000, // 1 second base delay
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Process production mode authentication (verify with backend)
 * Includes timeout and retry logic for network resilience
 */
async function processProductionAuth(credential: string): Promise<ProductionAuthResult> {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const { timeout, maxRetries, retryDelay } = PRODUCTION_AUTH_CONFIG

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${API_URL}/auth/google`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({ credential }),
        },
        timeout
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new AuthError(
          errorData.detail || 'Error authenticating with Google',
          'errors.authGoogleError'
        )
      }

      const data = await response.json()

      return {
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on auth errors (only retry on network/timeout errors)
      if (error instanceof AuthError) {
        throw error
      }

      // Check if it's an abort error (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new AuthError('Request timeout', 'errors.timeout')
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
    }
  }

  throw lastError instanceof AuthError
    ? lastError
    : new AuthError('Network error during authentication', 'errors.networkError')
}

// Pending auth requests tracked by unique ID to prevent race conditions
interface PendingAuthRequest {
  resolve: (value: void) => void
  reject: (reason: Error) => void
  timestamp: number
}

interface AuthState {
  // State
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  // Internal state for request management (moved from module scope to prevent memory leaks)
  _pendingRequests: Map<string, PendingAuthRequest>
  _currentRequestId: string | null

  // Actions
  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => void
  refreshAccessToken: () => Promise<boolean>
  clearError: () => void

  // Internal
  _handleGoogleCallback: (response: GoogleCredentialResponse) => Promise<void>
  _setError: (error: string) => void
  _cleanupPendingRequests: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
      // Internal state for request tracking (inside store to prevent memory leaks)
      _pendingRequests: new Map(),
      _currentRequestId: null,

      /**
       * Cleanup old pending requests (older than 60 seconds)
       * Prevents memory leaks from abandoned auth requests
       */
      _cleanupPendingRequests: () => {
        const state = get()
        const now = Date.now()
        const maxAge = 60 * 1000 // 60 seconds
        let hasChanges = false

        for (const [id, request] of state._pendingRequests.entries()) {
          if (now - request.timestamp > maxAge) {
            request.reject(new Error('Auth request timeout'))
            state._pendingRequests.delete(id)
            hasChanges = true
          }
        }

        // Only update state if we made changes
        if (hasChanges) {
          set({ _pendingRequests: new Map(state._pendingRequests) })
        }
      },

      /**
       * Initialize Google Auth
       * Should be called once on app startup
       */
      initialize: async () => {
        const state = get()
        if (state.isInitialized) return

        // Check if existing token is expired
        if (state.accessToken && isTokenExpired(state.accessToken)) {
          // Token expired, clear auth state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }

        // Check if Google OAuth is configured
        if (!isGoogleAuthConfigured()) {
          authStoreLogger.warn('Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID.')
          set({ isInitialized: true })
          return
        }

        try {
          await initializeGoogleAuth(get()._handleGoogleCallback)
          set({ isInitialized: true })
        } catch (error) {
          authStoreLogger.error('Failed to initialize Google Auth:', error)
          // Store i18n key as error - components should use t(error) to display
          set({
            isInitialized: true,
            error: 'errors.authInitFailed',
          })
        }
      },

      /**
       * Sign in with Google
       * Triggers the Google One Tap flow or button click
       */
      signInWithGoogle: async () => {
        const state = get()

        if (state.isLoading) {
          return // Already in progress
        }

        if (!state.isInitialized) {
          await get().initialize()
        }

        // Cleanup old requests first
        get()._cleanupPendingRequests()

        // Generate unique request ID
        const requestId = crypto.randomUUID()

        // Clear stale requests and set new request ID atomically
        const pendingRequests = new Map<string, PendingAuthRequest>()

        // Update state atomically to prevent race conditions
        set({
          isLoading: true,
          error: null,
          _currentRequestId: requestId,
          _pendingRequests: pendingRequests,
        })

        return new Promise<void>((resolve, reject) => {
          // Add the pending request after atomic state update
          pendingRequests.set(requestId, {
            resolve,
            reject,
            timestamp: Date.now(),
          })

          promptGoogleSignIn().catch((error) => {
            set({ isLoading: false })

            // Only reject if this is still the current request
            const currentState = get()
            const pending = currentState._pendingRequests.get(requestId)
            if (pending && currentState._currentRequestId === requestId) {
              pending.reject(error)
              currentState._pendingRequests.delete(requestId)
              set({ _currentRequestId: null })
            }
          })
        })
      },

      /**
       * Handle Google credential callback
       * Called by Google after successful sign-in
       */
      _handleGoogleCallback: async (response: GoogleCredentialResponse) => {
        const state = get()
        const requestId = state._currentRequestId
        const pending = requestId ? state._pendingRequests.get(requestId) : null

        try {
          // Validate response
          if ('error' in response && response.error) {
            throw new Error(response.error as string)
          }

          if (!response.credential) {
            throw new AuthError('No credential received from Google', 'errors.authGoogleNoCredential')
          }

          // Process authentication based on mode
          if (MOCK_MODE) {
            const user = processMockAuth(response.credential)
            set({
              user,
              accessToken: response.credential,
              refreshToken: null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          } else {
            const result = await processProductionAuth(response.credential)
            set({
              user: result.user,
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })
          }

          pending?.resolve()
        } catch (error) {
          // Use i18n key if available, otherwise use error message
          const errorKey = error instanceof AuthError
            ? error.i18nKey
            : (error instanceof Error ? error.message : 'errors.unknownError')
          set({ isLoading: false, error: errorKey })
          pending?.reject(error instanceof Error ? error : new Error(errorKey))
        } finally {
          if (requestId) {
            const currentState = get()
            currentState._pendingRequests.delete(requestId)
            if (currentState._currentRequestId === requestId) {
              set({ _currentRequestId: null })
            }
          }
        }
      },

      /**
       * Sign out
       * Clears local state and disables Google auto-select
       */
      signOut: () => {
        // Cancel any pending Google auth
        cancelGoogleSignIn()

        // Reject any pending requests
        const state = get()
        for (const [, request] of state._pendingRequests.entries()) {
          request.reject(new Error('User signed out'))
        }

        // Disable auto-select so user has to explicitly sign in again
        disableAutoSelect()

        // Clear state including pending requests
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          _pendingRequests: new Map(),
          _currentRequestId: null,
        })
      },

      /**
       * Refresh the access token using the refresh token
       * Returns true if successful, false otherwise
       */
      refreshAccessToken: async () => {
        const state = get()

        // In mock mode, check token expiration
        if (MOCK_MODE) {
          if (!state.accessToken || isTokenExpired(state.accessToken)) {
            get().signOut()
            return false
          }
          return state.isAuthenticated && state.user !== null
        }

        if (!state.refreshToken) {
          return false
        }

        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
              refresh_token: state.refreshToken,
            }),
          })

          if (!response.ok) {
            // Refresh token is invalid, sign out
            get().signOut()
            return false
          }

          const data = await response.json()

          set({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
          })

          return true
        } catch (error) {
          authStoreLogger.error('Failed to refresh token:', error)
          get().signOut()
          return false
        }
      },

      /**
       * Clear error message
       */
      clearError: () => {
        set({ error: null })
      },

      /**
       * Set error message (internal)
       */
      _setError: (error: string) => {
        set({ error, isLoading: false })
      },
    }),
    {
      name: 'pwamenu-auth',
      // Use sessionStorage instead of localStorage for better security
      // Tokens are cleared when browser tab closes
      storage: createJSONStorage(() => sessionStorage),
      // Only persist auth-related state, not internal request tracking
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        // Excluded: _pendingRequests, _currentRequestId, isLoading, isInitialized, error
      }),
    }
  )
)

// Selectors for optimized re-renders
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)
export const useAccessToken = () => useAuthStore((state) => state.accessToken)

// Composite selector for auth UI - uses useShallow for proper equality check
export const useAuthState = () =>
  useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      error: state.error,
    }))
  )

// Actions selector - uses useShallow for stable object reference
export const useAuthActions = () =>
  useAuthStore(
    useShallow((state) => ({
      initialize: state.initialize,
      signInWithGoogle: state.signInWithGoogle,
      signOut: state.signOut,
      clearError: state.clearError,
    }))
  )
