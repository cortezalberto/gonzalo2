/**
 * Zustand selectors for tableStore
 * Extracted to improve organization and reusability
 *
 * NOTE: Selectors that return objects use useShallow for shallow equality.
 * Derived values (reduce, filter, map) should be computed in components
 * with useMemo to avoid infinite re-render loops.
 */

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTableStore } from './store'
import type { CartItem, Diner } from '../../types'

// Stable empty array references to prevent re-renders when session is null
const EMPTY_CART_ITEMS: CartItem[] = []
const EMPTY_DINERS: Diner[] = []

// ============================================
// Simple selectors - subscribe to single values
// ============================================

export const useSession = () => useTableStore((state) => state.session)
export const useCurrentDiner = () => useTableStore((state) => state.currentDiner)
export const useIsLoading = () => useTableStore((state) => state.isLoading)
export const useIsSubmitting = () => useTableStore((state) => state.isSubmitting)
export const useLastOrderId = () => useTableStore((state) => state.lastOrderId)
export const useIsStale = () => useTableStore((state) => state.isStale)
export const useOrders = () => useTableStore((state) => state.orders)
export const useCurrentRound = () => useTableStore((state) => state.currentRound)

// ============================================
// Derived selectors - compute from state
// Use stable empty arrays to prevent unnecessary re-renders
// ============================================

export const useCartItems = () => useTableStore((state) => state.session?.shared_cart ?? EMPTY_CART_ITEMS)
export const useDiners = () => useTableStore((state) => state.session?.diners ?? EMPTY_DINERS)

// ============================================
// Composite selectors - reduce re-renders
// Derived values computed with useMemo in hook
// ============================================

/**
 * Header data selector - combines session info for header component
 */
export const useHeaderData = () => {
  const session = useTableStore((state) => state.session)
  const currentDiner = useTableStore((state) => state.currentDiner)

  // Compute derived values with useMemo using stable references
  const cartCount = useMemo(
    () => session?.shared_cart?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [session?.shared_cart]
  )
  const diners = useMemo(() => session?.diners ?? EMPTY_DINERS, [session?.diners])

  return { session, currentDiner, cartCount, diners }
}

/**
 * Shared cart data selector - all data needed for cart component
 */
export const useSharedCartData = () => {
  const session = useTableStore((state) => state.session)
  const currentDiner = useTableStore((state) => state.currentDiner)
  const isSubmitting = useTableStore((state) => state.isSubmitting)
  const lastOrderId = useTableStore((state) => state.lastOrderId)

  // Compute derived values with useMemo using stable references
  const cartItems = useMemo(() => session?.shared_cart ?? EMPTY_CART_ITEMS, [session?.shared_cart])
  const diners = useMemo(() => session?.diners ?? EMPTY_DINERS, [session?.diners])

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  )

  const myTotal = useMemo(
    () =>
      cartItems
        .filter((item) => item.diner_id === currentDiner?.id)
        .reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems, currentDiner?.id]
  )

  return { session, currentDiner, cartItems, cartTotal, myTotal, diners, isSubmitting, lastOrderId }
}

/**
 * Cart actions selector - stable action references
 * Uses useShallow for stable object reference
 */
export const useCartActions = () =>
  useTableStore(
    useShallow((state) => ({
      updateQuantity: state.updateQuantity,
      removeItem: state.removeItem,
      canModifyItem: state.canModifyItem,
      getDinerColor: state.getDinerColor,
      submitOrder: state.submitOrder,
      clearCart: state.clearCart,
    }))
  )

/**
 * Order history data selector - for order history component
 */
export const useOrderHistoryData = () => {
  const orders = useTableStore((state) => state.orders)
  const currentRound = useTableStore((state) => state.currentRound)
  const session = useTableStore((state) => state.session)

  // Compute derived values with useMemo
  const totalConsumed = useMemo(
    () => orders.reduce((sum, order) => sum + order.subtotal, 0),
    [orders]
  )

  const pendingOrders = useMemo(
    () => orders.filter((o) => !['delivered', 'paid', 'cancelled'].includes(o.status)),
    [orders]
  )

  const completedOrders = useMemo(
    () => orders.filter((o) => ['delivered', 'paid'].includes(o.status)),
    [orders]
  )

  return { orders, currentRound, totalConsumed, pendingOrders, completedOrders, session }
}

/**
 * Close table actions selector - for close table flow
 * Uses useShallow for stable object reference
 */
export const useCloseTableActions = () =>
  useTableStore(
    useShallow((state) => ({
      closeTable: state.closeTable,
      getPaymentShares: state.getPaymentShares,
      getTotalConsumed: state.getTotalConsumed,
      getTotalByDiner: state.getTotalByDiner,
      leaveTable: state.leaveTable,
    }))
  )
