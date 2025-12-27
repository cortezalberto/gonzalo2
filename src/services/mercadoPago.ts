/**
 * Mercado Pago Integration Service
 *
 * This service handles payment creation using Mercado Pago Checkout Pro.
 * In development mode, it simulates the payment flow.
 * In production, it calls the backend API to create payment preferences.
 *
 * @see https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
 */

import { apiLogger } from '../utils/logger'

// Environment configuration
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || ''
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'
const IS_DEV = import.meta.env.DEV

// Mercado Pago test credentials indicator
const IS_TEST_MODE = MP_PUBLIC_KEY.startsWith('TEST-') || IS_DEV

// Create module logger
const mpLogger = apiLogger

/**
 * Payment item structure for Mercado Pago preference
 */
export interface MPPaymentItem {
  id: string
  title: string
  description?: string
  quantity: number
  unit_price: number
  currency_id?: string
}

/**
 * Payer information
 */
export interface MPPayer {
  name?: string
  email?: string
  phone?: {
    area_code?: string
    number?: string
  }
}

/**
 * Payment preference request
 */
export interface MPPreferenceRequest {
  items: MPPaymentItem[]
  payer?: MPPayer
  external_reference?: string
  notification_url?: string
  back_urls?: {
    success: string
    failure: string
    pending: string
  }
  auto_return?: 'approved' | 'all'
  statement_descriptor?: string
  metadata?: Record<string, unknown>
}

/**
 * Payment preference response from backend/MP API
 */
export interface MPPreferenceResponse {
  id: string
  init_point: string
  sandbox_init_point: string
}

/**
 * Payment status after redirect
 */
export interface MPPaymentResult {
  collection_id: string | null
  collection_status: 'approved' | 'pending' | 'rejected' | 'cancelled' | null
  payment_id: string | null
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | null
  external_reference: string | null
  payment_type: string | null
  merchant_order_id: string | null
  preference_id: string | null
}

/**
 * Parse payment result from URL query parameters
 * Called after user returns from Mercado Pago checkout
 */
export function parsePaymentResult(searchParams: URLSearchParams): MPPaymentResult {
  return {
    collection_id: searchParams.get('collection_id'),
    collection_status: searchParams.get('collection_status') as MPPaymentResult['collection_status'],
    payment_id: searchParams.get('payment_id'),
    status: searchParams.get('status') as MPPaymentResult['status'],
    external_reference: searchParams.get('external_reference'),
    payment_type: searchParams.get('payment_type'),
    merchant_order_id: searchParams.get('merchant_order_id'),
    preference_id: searchParams.get('preference_id'),
  }
}

/**
 * Check if payment was successful
 */
export function isPaymentApproved(result: MPPaymentResult): boolean {
  return result.status === 'approved' || result.collection_status === 'approved'
}

/**
 * Check if payment is pending
 */
export function isPaymentPending(result: MPPaymentResult): boolean {
  return result.status === 'pending' || result.collection_status === 'pending'
}

/**
 * Simulated preference for development mode
 * Returns a mock preference that redirects to a simulated payment page
 */
function createMockPreference(request: MPPreferenceRequest): MPPreferenceResponse {
  const mockId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const baseUrl = window.location.origin

  // Calculate total for display
  const total = request.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

  // Create mock URLs that simulate the payment flow
  // In dev, we'll redirect to a local page that simulates the payment
  const successUrl = request.back_urls?.success || `${baseUrl}/payment/success`
  const mockParams = new URLSearchParams({
    preference_id: mockId,
    external_reference: request.external_reference || '',
    total: total.toFixed(2),
    status: 'approved',
    mock: 'true'
  })

  return {
    id: mockId,
    // In mock mode, we redirect directly to success with mock params
    init_point: `${successUrl}?${mockParams.toString()}`,
    sandbox_init_point: `${successUrl}?${mockParams.toString()}`
  }
}

/**
 * Create a payment preference
 *
 * In development mode: Creates a mock preference for testing
 * In production mode: Calls the backend API to create a real preference
 *
 * @param request Payment preference details
 * @returns Preference with checkout URL
 */
export async function createPaymentPreference(
  request: MPPreferenceRequest
): Promise<MPPreferenceResponse> {
  mpLogger.info('Creating payment preference', {
    itemCount: request.items.length,
    externalRef: request.external_reference,
    isTestMode: IS_TEST_MODE
  })

  // Development mode: Use mock
  if (IS_DEV && !MP_PUBLIC_KEY) {
    mpLogger.warn('Using mock payment preference (no MP_PUBLIC_KEY configured)')
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    return createMockPreference(request)
  }

  try {
    // Production mode: Call backend to create preference
    // The backend handles the MP SDK securely with the access token
    const response = await fetch(`${API_BASE}/payments/preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin',
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Payment error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    const preference: MPPreferenceResponse = await response.json()

    mpLogger.info('Payment preference created', { preferenceId: preference.id })

    return preference
  } catch (error) {
    mpLogger.error('Failed to create payment preference', error)
    throw error
  }
}

/**
 * Redirect to Mercado Pago checkout
 *
 * @param preference The preference response from createPaymentPreference
 * @param useSandbox Use sandbox URL (for testing with test credentials)
 */
export function redirectToCheckout(
  preference: MPPreferenceResponse,
  useSandbox: boolean = IS_TEST_MODE
): void {
  const checkoutUrl = useSandbox ? preference.sandbox_init_point : preference.init_point

  mpLogger.info('Redirecting to Mercado Pago checkout', {
    preferenceId: preference.id,
    useSandbox
  })

  window.location.href = checkoutUrl
}

/**
 * Create preference and redirect to checkout in one step
 * Convenience function for simple payment flows
 */
export async function initiatePayment(request: MPPreferenceRequest): Promise<void> {
  const preference = await createPaymentPreference(request)
  redirectToCheckout(preference)
}

/**
 * Get the public key for client-side MP SDK (if using Checkout Bricks)
 */
export function getPublicKey(): string {
  if (!MP_PUBLIC_KEY) {
    mpLogger.warn('MP_PUBLIC_KEY not configured')
  }
  return MP_PUBLIC_KEY
}

/**
 * Check if we're in test/sandbox mode
 */
export function isTestMode(): boolean {
  return IS_TEST_MODE
}

/**
 * Format currency for Argentina
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount)
}
