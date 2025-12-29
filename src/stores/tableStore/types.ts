/**
 * Types for tableStore
 */

import type { TableSession, Diner, CartItem, AddToCartInput, OrderRecord, OrderStatus, SplitMethod, PaymentShare } from '../../types'

/**
 * Auth context passed from component layer to avoid cross-store dependency
 */
export interface AuthContext {
  userId?: string
  fullName?: string
  email?: string
  picture?: string
}

/**
 * Table store state interface
 */
export interface TableState {
  // State
  session: TableSession | null
  currentDiner: Diner | null
  isLoading: boolean
  isSubmitting: boolean
  lastOrderId: string | null
  isStale: boolean
  orders: OrderRecord[]
  currentRound: number

  // Session actions
  joinTable: (tableNumber: string, tableName?: string, dinerName?: string, authContext?: AuthContext) => void
  leaveTable: () => void
  updateMyName: (name: string) => void
  setLoading: (loading: boolean) => void
  syncFromStorage: () => void  // MULTI-TAB FIX: Sync state from localStorage when other tab updates

  // Cart actions
  addToCart: (input: AddToCartInput) => void
  updateQuantity: (itemId: string, quantity: number) => void
  removeItem: (itemId: string) => void
  clearCart: () => void

  // Order actions
  submitOrder: () => Promise<{ success: boolean; orderId?: string; error?: string }>
  updateOrderStatus: (orderId: string, status: OrderStatus) => void

  // Payment actions
  closeTable: () => Promise<{ success: boolean; error?: string }>
  getPaymentShares: (method: SplitMethod) => PaymentShare[]

  // Getters
  getCartItems: () => CartItem[]
  getMyItems: () => CartItem[]
  getCartTotal: () => number
  getMyTotal: () => number
  getCartCount: () => number
  getDiners: () => Diner[]
  canModifyItem: (item: CartItem) => boolean
  getDinerColor: (dinerId: string) => string
  getOrderHistory: () => OrderRecord[]
  getTotalConsumed: () => number
  getTotalByDiner: (dinerId: string) => number
}
