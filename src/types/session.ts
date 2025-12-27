// ============================================
// PWA Menu - Diner & Cart Types
// ============================================

export interface Diner {
  id: string
  name: string
  avatar_color: string  // Color to identify the diner
  joined_at: string
  is_current_user: boolean
  user_id?: string      // Backend user ID if authenticated
  email?: string        // Email if authenticated
  picture?: string      // Profile picture URL if authenticated
}

export interface CartItem {
  id: string
  product_id: string
  name: string
  price: number
  image: string
  quantity: number
  diner_id: string      // Who added this item
  diner_name: string    // Diner name
  notes?: string        // Special notes for the item
}

// Input for adding items to cart
export interface AddToCartInput {
  product_id: string
  name: string
  price: number
  image?: string   // Optional - store provides fallback
  quantity?: number
  notes?: string
}

// ============================================
// PWA Menu - Table Session Types
// ============================================

export interface TableSession {
  id: string
  table_number: string
  table_name?: string
  restaurant_id: string
  branch_id?: string              // Optional branch reference
  status: 'active' | 'closed'
  created_at: string
  diners: Diner[]
  shared_cart: CartItem[]
}

// ============================================
// PWA Menu - Order Types
// ============================================

export type OrderStatus =
  | 'submitted'   // Just submitted
  | 'confirmed'   // Confirmed by kitchen
  | 'preparing'   // In preparation
  | 'ready'       // Ready to serve
  | 'delivered'   // Delivered to table
  | 'paid'        // Paid
  | 'cancelled'   // Cancelled

export interface OrderRecord {
  id: string
  round_number: number        // Round number (1, 2, 3...)
  items: CartItem[]
  subtotal: number            // Sum of items
  status: OrderStatus
  submitted_by: string        // Diner ID who submitted
  submitted_by_name: string   // Diner name
  submitted_at: string        // Submission timestamp
  confirmed_at?: string       // When kitchen confirmed
  ready_at?: string           // When ready
  delivered_at?: string       // When delivered
}

// Order submission process state
export type OrderState = 'idle' | 'submitting' | 'success' | 'error'

// ============================================
// PWA Menu - Payment Types
// ============================================

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed'
export type SplitMethod = 'equal' | 'by_consumption' | 'custom'

export interface PaymentShare {
  diner_id: string
  diner_name: string
  amount: number
  paid: boolean
  paid_at?: string
  method?: PaymentMethod
}

export interface TablePayment {
  id: string
  table_session_id: string
  total_amount: number
  split_method: SplitMethod
  shares: PaymentShare[]
  completed: boolean
  completed_at?: string
}

/**
 * @deprecated Use OrderRecord instead. This type is only used in api.ts
 * for backwards compatibility with the backend API contract.
 * TODO: Remove when backend migrates to OrderRecord response format.
 */
export interface Order {
  id: string
  table_session_id: string
  items: CartItem[]
  total: number
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered'
  created_at: string
  submitted_by: string  // Diner ID who submitted the order
}
