// ============================================
// Type Exports - Organized by Domain
// ============================================
// This file re-exports all types from domain-specific modules
// for backwards compatibility with existing imports.

// Restaurant & Branch
export type {
  Restaurant,
  Branch,
  BranchFormData,
  RestaurantFormData,
} from './restaurant'

// Catalog (Categories, Products, Allergens)
export type {
  Category,
  Subcategory,
  CategoryFormData,
  SubcategoryFormData,
  Allergen,
  AllergenFormData,
  BranchPrice,
  Product,
  ProductFormData,
} from './catalog'

// Promotions
export type {
  PromotionType,
  PromotionTypeFormData,
  PromotionItem,
  Promotion,
  PromotionFormData,
} from './promotion'

// Physical Tables & Kitchen Commands
export type {
  TableStatus,
  RestaurantTable,
  RestaurantTableFormData,
  OrderCommandItem,
  OrderCommand,
  OrderHistoryRecord,
} from './table'

// PWA Session (Diners, Cart, Orders, Payments)
export type {
  Diner,
  CartItem,
  AddToCartInput,
  TableSession,
  OrderStatus,
  OrderRecord,
  OrderState,
  PaymentMethod,
  SplitMethod,
  PaymentShare,
  TablePayment,
  Order,
} from './session'

// Authentication (Google OAuth)
export type {
  AuthUser,
  GoogleAuthResponse,
  GoogleCredentialResponse,
  GoogleAccountsId,
  GoogleIdConfiguration,
  PromptMomentNotification,
  GsiButtonConfiguration,
} from './auth'

// UI Components
export type {
  TableColumn,
  Toast,
} from './ui'
