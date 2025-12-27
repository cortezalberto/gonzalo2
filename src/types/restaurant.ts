// ============================================
// Restaurant & Branch Types
// ============================================

export interface Restaurant {
  id: string
  name: string
  slug: string
  description: string
  logo?: string
  banner?: string
  theme_color: string
  address?: string
  phone?: string
  email?: string
  created_at?: string
  updated_at?: string
}

export interface Branch {
  id: string
  name: string
  restaurant_id: string
  address?: string
  phone?: string
  email?: string
  image?: string
  opening_time: string              // Horario de apertura (HH:mm)
  closing_time: string              // Horario de cierre (HH:mm)
  is_active?: boolean
  order: number
  created_at?: string
  updated_at?: string
}

export interface BranchFormData {
  name: string
  address?: string
  phone?: string
  email?: string
  image?: string
  opening_time: string              // HH:mm format
  closing_time: string              // HH:mm format
  is_active: boolean
  order: number
}

export interface RestaurantFormData {
  name: string
  slug: string
  description: string
  logo?: string
  banner?: string
  theme_color: string
  address?: string
  phone?: string
  email?: string
}
