/**
 * tableStore module barrel file
 *
 * This module was refactored from a 677-line monolithic store into:
 * - store.ts: Main Zustand store (~350 lines)
 * - selectors.ts: React hooks for accessing state
 * - helpers.ts: Pure utility functions
 * - types.ts: TypeScript interfaces
 */

// Main store
export { useTableStore } from './store'

// Types
export type { AuthContext, TableState } from './types'

// Selectors (React hooks)
export {
  // Simple selectors
  useSession,
  useCurrentDiner,
  useIsLoading,
  useIsSubmitting,
  useLastOrderId,
  useIsStale,
  useOrders,
  useCurrentRound,
  // Derived selectors
  useCartItems,
  useDiners,
  // Composite selectors
  useHeaderData,
  useSharedCartData,
  useCartActions,
  useOrderHistoryData,
  useCloseTableActions,
} from './selectors'

// Helpers (for testing or external use)
export {
  isSessionExpired,
  isSessionStale,
  isValidPrice,
  isValidQuantity,
  generateId,
  generateDinerName,
  getColorForIndex,
  calculateCartTotal,
  calculateDinerTotal,
  calculateTotalConsumed,
  calculateTotalByDiner,
  calculatePaymentShares,
  getSessionAgeHours,
} from './helpers'
