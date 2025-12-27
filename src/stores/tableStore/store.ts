/**
 * Main Zustand store for table session management
 * Refactored from monolithic tableStore.ts
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Diner, OrderRecord } from '../../types'
import type { TableState, AuthContext } from './types'
import { tableStoreLogger } from '../../utils/logger'
import { sanitizeText, FALLBACK_IMAGES } from '../../utils/validation'
import {
  isSessionExpired,
  isSessionStale,
  isValidPrice,
  isValidQuantity,
  generateId,
  generateDinerName,
  getColorForIndex,
  getSessionAgeHours,
  calculatePaymentShares,
  calculateCartTotal,
  calculateTotalConsumed,
  calculateTotalByDiner,
  withRetry,
  shouldExecute,
} from './helpers'

// Stable empty arrays to prevent new reference on each getter call
const EMPTY_CART_ITEMS: CartItem[] = []
const EMPTY_DINERS: Diner[] = []

export const useTableStore = create<TableState>()(
  persist(
    (set, get) => ({
      // Initial state
      session: null,
      currentDiner: null,
      isLoading: false,
      isSubmitting: false,
      lastOrderId: null,
      isStale: false,
      orders: [],
      currentRound: 0,

      // =====================
      // SESSION ACTIONS
      // =====================

      joinTable: (tableNumber: string, tableName?: string, dinerName?: string, authContext?: AuthContext) => {
        set((state) => {
          if (state.isLoading) {
            return state
          }

          let session = state.session
          const currentDiner = state.currentDiner

          // Already at this table
          if (session && session.table_number === tableNumber && currentDiner) {
            const existingDiner = session.diners.find(d => d.id === currentDiner.id)
            if (existingDiner) {
              return { ...state, isLoading: false }
            }
          }

          // Create new session or join existing one
          if (!session || session.table_number !== tableNumber) {
            const restaurantId = import.meta.env.VITE_RESTAURANT_ID || 'default'
            session = {
              id: generateId(),
              table_number: tableNumber,
              table_name: tableName,
              restaurant_id: restaurantId,
              status: 'active',
              created_at: new Date().toISOString(),
              diners: [],
              shared_cart: [],
            }
          }

          // Create new diner
          const dinerIndex = session.diners.length
          const newDiner: Diner = {
            id: generateId(),
            name: dinerName || authContext?.fullName || generateDinerName(dinerIndex),
            avatar_color: getColorForIndex(dinerIndex),
            joined_at: new Date().toISOString(),
            is_current_user: true,
            user_id: authContext?.userId,
            email: authContext?.email,
            picture: authContext?.picture,
          }

          // Mark other diners as not current
          const updatedDiners = session.diners.map(d => ({ ...d, is_current_user: false }))
          updatedDiners.push(newDiner)

          return {
            ...state,
            isLoading: false,
            session: { ...session, diners: updatedDiners },
            currentDiner: newDiner,
          }
        })
      },

      leaveTable: () => {
        set({
          session: null,
          currentDiner: null,
          lastOrderId: null,
          isStale: false,
          orders: [],
          currentRound: 0,
        })
      },

      updateMyName: (newName: string) => {
        const { session, currentDiner } = get()
        if (!session || !currentDiner) return

        const updatedDiners = session.diners.map(d =>
          d.id === currentDiner.id ? { ...d, name: newName } : d
        )

        const updatedCart = session.shared_cart.map(item =>
          item.diner_id === currentDiner.id ? { ...item, diner_name: newName } : item
        )

        set({
          session: { ...session, diners: updatedDiners, shared_cart: updatedCart },
          currentDiner: { ...currentDiner, name: newName },
        })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      // =====================
      // CART ACTIONS
      // =====================

      addToCart: (input) => {
        const { session, currentDiner } = get()
        if (!session || !currentDiner) return

        // Throttle rapid successive adds of the same product
        if (!shouldExecute(`addToCart-${input.product_id}`, 200)) {
          tableStoreLogger.debug('addToCart throttled', { product_id: input.product_id })
          return
        }

        if (!isValidPrice(input.price)) {
          tableStoreLogger.warn('Invalid price in addToCart', { price: input.price })
          return
        }

        const quantity = input.quantity || 1
        if (!isValidQuantity(quantity)) {
          tableStoreLogger.warn('Invalid quantity in addToCart', { quantity })
          return
        }

        const newItem: CartItem = {
          id: generateId(),
          product_id: input.product_id,
          name: input.name,
          price: input.price,
          image: input.image || FALLBACK_IMAGES.product,
          quantity,
          diner_id: currentDiner.id,
          diner_name: currentDiner.name,
          notes: input.notes ? sanitizeText(input.notes) : undefined,
        }

        set({
          session: {
            ...session,
            shared_cart: [...session.shared_cart, newItem],
          },
        })
      },

      updateQuantity: (itemId: string, quantity: number) => {
        const { session, currentDiner } = get()
        if (!session || !currentDiner) return

        // Throttle rapid quantity updates on the same item
        if (!shouldExecute(`updateQuantity-${itemId}`, 100)) {
          return
        }

        const item = session.shared_cart.find(i => i.id === itemId)
        if (!item || item.diner_id !== currentDiner.id) return

        if (typeof quantity !== 'number' || !isFinite(quantity) || isNaN(quantity)) {
          tableStoreLogger.warn('Invalid quantity in updateQuantity', { quantity })
          return
        }

        let updatedCart: CartItem[]
        if (quantity <= 0) {
          updatedCart = session.shared_cart.filter(i => i.id !== itemId)
        } else if (quantity > 99) {
          updatedCart = session.shared_cart.map(i =>
            i.id === itemId ? { ...i, quantity: 99 } : i
          )
        } else {
          updatedCart = session.shared_cart.map(i =>
            i.id === itemId ? { ...i, quantity: Math.floor(quantity) } : i
          )
        }

        set({
          session: { ...session, shared_cart: updatedCart },
        })
      },

      removeItem: (itemId: string) => {
        get().updateQuantity(itemId, 0)
      },

      clearCart: () => {
        const { session } = get()
        if (!session) return
        set({ session: { ...session, shared_cart: [] } })
      },

      // =====================
      // ORDER ACTIONS
      // =====================

      submitOrder: async () => {
        const state = get()

        if (state.isSubmitting) {
          return { success: false, error: 'An order is already being submitted' }
        }

        if (!state.session || !state.currentDiner) {
          return { success: false, error: 'No active session' }
        }

        if (state.session.shared_cart.length === 0) {
          return { success: false, error: 'Cart is empty' }
        }

        // Capture cart items before async operation for potential rollback
        const cartItems = [...state.session.shared_cart]
        const submitterId = state.currentDiner.id
        const submitterName = state.currentDiner.name
        const previousRound = state.currentRound

        // Optimistic update: clear cart immediately for instant feedback
        set({
          isSubmitting: true,
          session: { ...state.session, shared_cart: [] }
        })

        try {
          // Use withRetry for API calls when backend is connected
          // Currently simulated - replace with actual API call
          await withRetry(
            async () => {
              // TODO: Replace with actual API call: await api.createOrder(orderData)
              await new Promise(resolve => setTimeout(resolve, 1500))
            },
            { maxRetries: 3, baseDelayMs: 1000 }
          )

          const orderId = generateId()
          const subtotal = calculateCartTotal(cartItems)

          const newOrder: OrderRecord = {
            id: orderId,
            round_number: previousRound + 1,
            items: cartItems,
            subtotal,
            status: 'submitted',
            submitted_by: submitterId,
            submitted_by_name: submitterName,
            submitted_at: new Date().toISOString(),
          }

          // Use functional update to avoid stale state
          set((currentState) => {
            if (!currentState.session) return { isSubmitting: false }

            return {
              orders: [...currentState.orders, newOrder],
              currentRound: previousRound + 1,
              isSubmitting: false,
              lastOrderId: orderId,
            }
          })

          return { success: true, orderId }
        } catch (error) {
          // Rollback: restore cart items on failure
          set((currentState) => {
            if (!currentState.session) return { isSubmitting: false }

            tableStoreLogger.warn('Order submission failed, rolling back cart', { itemCount: cartItems.length })

            return {
              isSubmitting: false,
              session: {
                ...currentState.session,
                // Merge back the original cart items (in case new items were added during submission)
                shared_cart: [...cartItems, ...currentState.session.shared_cart]
              }
            }
          })

          tableStoreLogger.error('Failed to submit order after retries', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Error submitting order'
          }
        }
      },

      updateOrderStatus: (orderId: string, status) => {
        const { orders } = get()
        const updatedOrders = orders.map(order => {
          if (order.id !== orderId) return order

          const updates: Partial<OrderRecord> = { status }
          const now = new Date().toISOString()

          if (status === 'confirmed') updates.confirmed_at = now
          if (status === 'ready') updates.ready_at = now
          if (status === 'delivered') updates.delivered_at = now

          return { ...order, ...updates }
        })

        set({ orders: updatedOrders })
      },

      // =====================
      // PAYMENT ACTIONS
      // =====================

      closeTable: async () => {
        const state = get()

        if (!state.session) {
          return { success: false, error: 'No active session' }
        }

        if (state.orders.length === 0) {
          return { success: false, error: 'No orders to close' }
        }

        if (state.session.shared_cart.length > 0) {
          return { success: false, error: 'There are items in cart not submitted' }
        }

        set({ isLoading: true })

        try {
          // Use withRetry for API calls when backend is connected
          // Currently simulated - replace with actual API call
          await withRetry(
            async () => {
              // TODO: Replace with actual API call: await api.closeTable(session.id)
              await new Promise(resolve => setTimeout(resolve, 1000))
            },
            { maxRetries: 3, baseDelayMs: 1000 }
          )

          // Use functional update to avoid stale state after async operation
          set((currentState) => {
            if (!currentState.session) return { isLoading: false }

            return {
              session: { ...currentState.session, status: 'closed' },
              isLoading: false,
            }
          })

          return { success: true }
        } catch (error) {
          set({ isLoading: false })
          tableStoreLogger.error('Failed to close table after retries', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Error closing table'
          }
        }
      },

      getPaymentShares: (method) => {
        const { session, orders } = get()
        if (!session) return []
        return calculatePaymentShares(session.diners || [], orders, method)
      },

      // =====================
      // GETTERS
      // =====================

      getCartItems: () => get().session?.shared_cart || EMPTY_CART_ITEMS,

      getMyItems: () => {
        const { session, currentDiner } = get()
        if (!session || !currentDiner) return EMPTY_CART_ITEMS
        return session.shared_cart.filter(item => item.diner_id === currentDiner.id)
      },

      getCartTotal: () => {
        return calculateCartTotal(get().getCartItems())
      },

      getMyTotal: () => {
        return calculateCartTotal(get().getMyItems())
      },

      getCartCount: () => {
        const items = get().getCartItems()
        return items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getDiners: () => get().session?.diners || EMPTY_DINERS,

      canModifyItem: (item) => {
        const { currentDiner } = get()
        return currentDiner?.id === item.diner_id
      },

      getDinerColor: (dinerId: string) => {
        const { session } = get()
        const diner = session?.diners.find(d => d.id === dinerId)
        return diner?.avatar_color || '#888888'
      },

      getOrderHistory: () => get().orders,

      getTotalConsumed: () => {
        return calculateTotalConsumed(get().orders)
      },

      getTotalByDiner: (dinerId: string) => {
        return calculateTotalByDiner(get().orders, dinerId)
      },
    }),
    {
      name: 'pwamenu-table-storage',
      partialize: (state) => ({
        session: state.session,
        currentDiner: state.currentDiner,
        orders: state.orders,
        currentRound: state.currentRound,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.session) {
          if (isSessionExpired(state.session.created_at)) {
            state.session = null
            state.currentDiner = null
            state.orders = []
            state.currentRound = 0
            state.lastOrderId = null
            tableStoreLogger.info('Session expired, clearing data')
            return
          }

          if (isSessionStale(state.session.created_at)) {
            const ageHours = getSessionAgeHours(state.session.created_at)
            tableStoreLogger.warn(`Session is ${ageHours}h old. Data might be outdated.`)
            state.isStale = true
          }

          if (state.currentDiner) {
            const syncedDiners = state.session.diners.map(d => ({
              ...d,
              is_current_user: d.id === state.currentDiner!.id,
            }))
            state.session = { ...state.session, diners: syncedDiners }
          }
        }
      },
    }
  )
)
