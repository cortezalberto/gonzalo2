/**
 * Google Identity Services (GIS) Authentication Service
 *
 * Handles Google Sign-In using the new Google Identity Services library.
 * This replaces the deprecated gapi.auth2 library.
 *
 * @see https://developers.google.com/identity/gsi/web
 */

import type { GoogleCredentialResponse, PromptMomentNotification } from '../types'
import { googleAuthLogger } from '../utils/logger'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

// Store nonce for CSRF protection
let currentNonce: string | null = null

/**
 * Generate a cryptographically secure nonce for CSRF protection
 */
function generateNonce(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get the current nonce (for verification after callback)
 */
export function getCurrentNonce(): string | null {
  return currentNonce
}

/**
 * Verify that the nonce in the JWT matches the expected nonce
 * This provides CSRF protection by ensuring the token was generated for this session
 * @param credential - The JWT credential from Google
 * @returns true if nonce matches or verification is skipped, false if mismatch
 */
export function verifyNonce(credential: string): boolean {
  if (!currentNonce) {
    googleAuthLogger.warn('No nonce to verify against - skipping verification')
    return true // Skip verification if no nonce was set
  }

  try {
    // Decode the JWT payload (middle part)
    const parts = credential.split('.')
    if (parts.length !== 3) {
      googleAuthLogger.error('Invalid JWT format')
      return false
    }

    // Decode base64url to get payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    if (payload.nonce !== currentNonce) {
      googleAuthLogger.error('Nonce mismatch - possible CSRF attack', {
        expected: currentNonce.substring(0, 8) + '...',
        received: payload.nonce?.substring(0, 8) + '...'
      })
      return false
    }

    googleAuthLogger.debug('Nonce verified successfully')
    return true
  } catch (error) {
    googleAuthLogger.error('Failed to verify nonce', error)
    return false
  }
}

/**
 * Clear the current nonce (call after successful verification)
 */
export function clearNonce(): void {
  currentNonce = null
}


// Type guard to verify google.accounts.id is available
function isGoogleAccountsIdAvailable(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
    window.google?.accounts?.id &&
    typeof window.google.accounts.id.initialize === 'function'
  )
}

// Track script loading state
let scriptLoadPromise: Promise<void> | null = null
let isInitialized = false

/**
 * Load the Google Identity Services script
 * Returns a promise that resolves when the script is loaded
 */
export async function loadGoogleScript(): Promise<void> {
  // Return existing promise if already loading
  if (scriptLoadPromise) {
    return scriptLoadPromise
  }

  // Check if already loaded
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Validate we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Google Auth requires a browser environment'))
      return
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`)
    if (existingScript) {
      // Script exists, wait for it to load
      if (window.google?.accounts?.id) {
        resolve()
        return
      }
      // Create handlers that clean each other up to prevent memory leaks
      const handleLoad = () => {
        existingScript.removeEventListener('error', handleError)
        resolve()
      }
      const handleError = () => {
        existingScript.removeEventListener('load', handleLoad)
        scriptLoadPromise = null // Reset so next call can retry
        reject(new Error('Failed to load Google script'))
      }

      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }

    // Create and inject script
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.defer = true

    script.onload = () => {
      resolve()
    }

    script.onerror = () => {
      scriptLoadPromise = null // Reset so next call can retry
      reject(new Error('Failed to load Google Identity Services script'))
    }

    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

/**
 * Initialize Google Identity Services
 * Must be called before any other GIS functions
 */
export async function initializeGoogleAuth(
  callback: (response: GoogleCredentialResponse) => void
): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID environment variable is not set')
  }

  await loadGoogleScript()

  if (!isGoogleAccountsIdAvailable()) {
    throw new Error('Google Identity Services not available')
  }

  // Generate new nonce for CSRF protection
  currentNonce = generateNonce()

  window.google!.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback,
    auto_select: false, // Don't auto-select on page load
    cancel_on_tap_outside: true,
    context: 'signin',
    ux_mode: 'popup', // Popup mode - COOP warning can be ignored, sign-in still works
    itp_support: true, // Support Intelligent Tracking Prevention (Safari)
    nonce: currentNonce, // CSRF protection - nonce is included in the ID token
  })

  isInitialized = true
}

/**
 * Prompt the user to sign in with Google
 * Shows the One Tap prompt or falls back to button
 */
export async function promptGoogleSignIn(): Promise<void> {
  if (!isInitialized) {
    throw new Error('Google Auth not initialized. Call initializeGoogleAuth first.')
  }

  return new Promise((resolve, reject) => {
    window.google!.accounts.id.prompt((notification: PromptMomentNotification) => {
      if (notification.isDisplayed()) {
        // Prompt was shown successfully
        resolve()
      } else if (notification.isNotDisplayed()) {
        // Prompt couldn't be shown - user may have dismissed before
        const reason = notification.getNotDisplayedReason()
        googleAuthLogger.warn('Google Sign-In prompt not displayed:', reason)

        // These reasons are ok, user can use the button instead
        if (reason === 'opt_out_or_no_session' || reason === 'suppressed_by_user') {
          resolve() // Not an error, just use button
        } else {
          reject(new Error(`Google Sign-In not available: ${reason}`))
        }
      } else if (notification.isSkippedMoment()) {
        // User skipped the prompt
        resolve()
      } else if (notification.isDismissedMoment()) {
        // User dismissed the prompt
        resolve()
      }
    })
  })
}

/**
 * Render a Google Sign-In button in the specified element
 */
export function renderGoogleButton(
  elementId: string,
  options?: {
    theme?: 'outline' | 'filled_blue' | 'filled_black'
    size?: 'large' | 'medium' | 'small'
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
    shape?: 'rectangular' | 'pill'
    width?: number
    locale?: string
  }
): void {
  if (!isInitialized) {
    throw new Error('Google Auth not initialized. Call initializeGoogleAuth first.')
  }

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`)
  }

  window.google!.accounts.id.renderButton(element, {
    type: 'standard',
    theme: options?.theme ?? 'filled_black',
    size: options?.size ?? 'large',
    text: options?.text ?? 'continue_with',
    shape: options?.shape ?? 'rectangular',
    width: options?.width ?? 300,
    logo_alignment: 'left',
    locale: options?.locale ?? 'es',
  })
}

/**
 * Disable auto-select for the current session
 * Call this when user explicitly signs out
 */
export function disableAutoSelect(): void {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect()
  }
}

/**
 * Cancel any ongoing Google Sign-In flow
 */
export function cancelGoogleSignIn(): void {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.cancel()
  }
}

/**
 * Check if Google Client ID is configured
 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID)
}

/**
 * Get the configured Google Client ID (for debugging)
 */
export function getGoogleClientId(): string | undefined {
  return GOOGLE_CLIENT_ID
}
