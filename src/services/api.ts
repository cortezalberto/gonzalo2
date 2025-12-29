import type { Product, Category, OrderRecord } from '../types'
import { apiLogger } from '../utils/logger'
import { API_CONFIG } from '../constants'
import { ApiError, ERROR_CODES } from '../utils/errors'

// Re-export ApiError for backwards compatibility
export { ApiError } from '../utils/errors'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

// Use centralized config for SSRF prevention (single source of truth)
// IMPORTANT: Only allow exactly these hosts, not subdomains
const ALLOWED_HOSTS = new Set<string>(API_CONFIG.ALLOWED_HOSTS)
const ALLOWED_PORTS = new Set<string>(API_CONFIG.ALLOWED_PORTS)

// Validate that the base URL is secure
function isValidApiBase(url: string): boolean {
  try {
    // Relative URLs are always valid (same-origin)
    if (url.startsWith('/') && !url.startsWith('//')) return true

    const parsed = new URL(url)

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false

    // SECURITY: Prevent SSRF via IP addresses (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i

    if (ipv4Regex.test(parsed.hostname) || ipv6Regex.test(parsed.hostname)) {
      apiLogger.warn('IP addresses not allowed in API URL:', parsed.hostname)
      throw new ApiError('IP addresses not allowed in API URL', 0, ERROR_CODES.VALIDATION)
    }

    // SECURITY: Prevent credentials in URL (userinfo)
    if (parsed.username || parsed.password) {
      apiLogger.warn('URL credentials not allowed')
      throw new ApiError('Credentials not allowed in URL', 0, ERROR_CODES.VALIDATION)
    }

    // Check EXACT allowed host (no subdomains to prevent evil.localhost)
    const isAllowedHost = ALLOWED_HOSTS.has(parsed.hostname)

    // SECURITY FIX: Normalize port (empty string defaults to protocol default)
    const normalizedPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
    const isAllowedPort = ALLOWED_PORTS.has(normalizedPort)

    // For allowed hosts, also check port to prevent SSRF via port
    if (isAllowedHost && !isAllowedPort) {
      apiLogger.warn(`Port ${normalizedPort} not in allowed list for ${parsed.hostname}`)
      return false
    }

    if (isAllowedHost) {
      return true
    }

    // Check same-origin - but also validate port for security
    const isSameOrigin = typeof window !== 'undefined' &&
      parsed.origin === window.location.origin

    if (isSameOrigin) {
      // For same-origin, validate port matches current page or is in allowed list
      const currentPort = typeof window !== 'undefined' ? window.location.port : ''

      // Normalize ports to handle both '' and undefined as default port
      const normalizedParsedPort = parsed.port || ''
      const normalizedCurrentPort = currentPort || ''

      const isValidSameOriginPort = isAllowedPort ||
        normalizedParsedPort === normalizedCurrentPort

      if (!isValidSameOriginPort) {
        apiLogger.warn(`Same-origin request on unusual port: ${parsed.port}`)
        return false
      }
      return true
    }

    return false
  } catch {
    return false
  }
}

// Validate API_BASE at startup - strict in production
if (!isValidApiBase(API_BASE)) {
  if (import.meta.env.DEV) {
    apiLogger.warn('API_BASE is not a valid or secure URL:', API_BASE)
  } else {
    // In production, throw to prevent potential SSRF attacks
    throw new Error(`Invalid API_BASE configuration. Requests blocked for security.`)
  }
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
  timeout?: number
  /** Skip deduplication for this request (e.g., for mutations that should always execute) */
  skipDedup?: boolean
  /** Include authorization token in request */
  auth?: boolean
}

// Token getter function - can be set by auth store
let getAuthToken: (() => string | null) | null = null

/**
 * Set the function to get the current auth token
 * Called by authStore to inject token getter
 */
export function setAuthTokenGetter(getter: () => string | null): void {
  getAuthToken = getter
}

// Request deduplication to prevent race conditions from rapid clicks
// RACE CONDITION FIX: Store body for comparison instead of hash to prevent collisions
const pendingRequests = new Map<string, { body: string | undefined; promise: Promise<unknown> }>()

// MEMORY LEAK FIX: Prevent unbounded growth of pendingRequests
const MAX_PENDING_REQUESTS = 100
const PENDING_REQUESTS_CLEANUP_INTERVAL = 60 * 1000 // Check every minute
let lastPendingCleanup = Date.now()

/**
 * Clean up pendingRequests Map to prevent memory leaks
 * In normal operation, requests complete quickly and clean themselves up.
 * This is a safety measure for stuck/long-running requests.
 */
function cleanupPendingRequests(): void {
  const now = Date.now()

  // MEMORY LEAK FIX: If map exceeds max size, log warning and clear oldest entries
  if (pendingRequests.size > MAX_PENDING_REQUESTS) {
    apiLogger.warn(`pendingRequests exceeded ${MAX_PENDING_REQUESTS}, clearing to prevent memory leak`)
    pendingRequests.clear()
    lastPendingCleanup = now
    return
  }

  // Only cleanup periodically to avoid performance impact
  if (now - lastPendingCleanup < PENDING_REQUESTS_CLEANUP_INTERVAL) {
    return
  }

  lastPendingCleanup = now
  // Log if we have many pending requests (potential issue)
  if (pendingRequests.size > 20) {
    apiLogger.warn(`High number of pending requests: ${pendingRequests.size}`)
  }
}

// RACE CONDITION FIX: Use only method + endpoint as base key
// Body comparison is done separately to prevent hash collisions
function getRequestKey(method: string, endpoint: string): string {
  return `${method}:${endpoint}`
}

interface OrderCreateData {
  items: Array<{
    id: string
    quantity: number
  }>
  table_id?: string
  notes?: string
}

// Legacy error codes mapping for backwards compatibility
// Use ERROR_CODES from utils/errors for new code
export const API_ERROR_CODES = {
  TIMEOUT_ERROR: ERROR_CODES.TIMEOUT,
  NETWORK_ERROR: ERROR_CODES.NETWORK,
  EMPTY_RESPONSE: ERROR_CODES.EMPTY_RESPONSE,
  PARSE_ERROR: ERROR_CODES.PARSE_ERROR,
  UNKNOWN_ERROR: ERROR_CODES.UNKNOWN,
  HTTP_ERROR: ERROR_CODES.HTTP_ERROR,
} as const

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const { timeout = 30000, skipDedup = false, auth = false, ...fetchOptions } = options
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const bodyStr = typeof fetchOptions.body === 'string' ? fetchOptions.body : undefined

  // MEMORY LEAK FIX: Periodic cleanup of pending requests
  cleanupPendingRequests()

  // RACE CONDITION FIX: Request deduplication with direct body comparison
  const baseKey = getRequestKey(method, endpoint)
  if (!skipDedup) {
    // Search for existing request with same method, endpoint AND body
    for (const [key, cached] of pendingRequests.entries()) {
      if (key.startsWith(baseKey) && cached.body === bodyStr) {
        apiLogger.debug('Request deduplicated', { method, endpoint })
        return cached.promise as Promise<T>
      }
    }
  }

  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Build headers with optional auth token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Basic CSRF protection
    ...fetchOptions.headers
  }

  // Add Authorization header if auth is enabled and token is available
  if (auth && getAuthToken) {
    const token = getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const config: RequestInit = {
    headers,
    credentials: 'same-origin', // Only send cookies to same origin
    signal: controller.signal,
    ...fetchOptions
  }

  // RACE CONDITION FIX: Generate unique key for this request
  const uniqueKey = `${baseKey}:${Date.now()}`

  // Create the request promise and store it for deduplication
  const requestPromise = (async (): Promise<T> => {
    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new ApiError(
          error.detail || `HTTP ${response.status}`,
          response.status,
          error.code || API_ERROR_CODES.HTTP_ERROR
        )
      }

      // Handle empty responses - throw explicit error
      const text = await response.text()
      if (!text || text.trim() === '') {
        // 204 No Content is valid for empty responses
        if (response.status === 204) {
          return {} as T
        }
        // Other empty responses are errors
        throw new ApiError(
          'Empty response',
          response.status,
          API_ERROR_CODES.EMPTY_RESPONSE
        )
      }

      try {
        return JSON.parse(text) as T
      } catch {
        throw new ApiError(
          'Parse error',
          response.status,
          API_ERROR_CODES.PARSE_ERROR
        )
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof ApiError) {
        throw error
      }
      // Timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 0, API_ERROR_CODES.TIMEOUT_ERROR)
      }
      // Network or fetch error
      if (error instanceof TypeError) {
        throw new ApiError('Network error', 0, API_ERROR_CODES.NETWORK_ERROR)
      }
      apiLogger.error(`API Error [${endpoint}]:`, error)
      throw new ApiError('Unknown error', 500, API_ERROR_CODES.UNKNOWN_ERROR)
    } finally {
      // RACE CONDITION FIX: Remove from pending requests when done (success or error)
      // Use unique key with timestamp to avoid conflicts
      pendingRequests.delete(uniqueKey)
    }
  })()

  // RACE CONDITION FIX: Store promise with body for deduplication
  if (!skipDedup) {
    pendingRequests.set(uniqueKey, { body: bodyStr, promise: requestPromise })
  }

  return requestPromise
}

export const api = {
  // Menu endpoints
  getMenu(restaurantSlug: string): Promise<{ categories: Category[]; items: Product[] }> {
    return request(`/public/menu/${restaurantSlug}`)
  },

  getCategories(restaurantSlug: string): Promise<Category[]> {
    return request(`/public/menu/${restaurantSlug}/categories`)
  },

  getMenuItem(restaurantSlug: string, itemId: string): Promise<Product> {
    return request(`/public/menu/${restaurantSlug}/items/${itemId}`)
  },

  // Orders
  createOrder(data: OrderCreateData): Promise<OrderRecord> {
    return request('/public/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  getOrderStatus(orderId: string): Promise<OrderRecord> {
    return request(`/public/orders/${orderId}`)
  }
}
