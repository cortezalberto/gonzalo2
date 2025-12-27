// ============================================
// Promotion Types
// ============================================

export interface PromotionType {
  id: string
  name: string
  description?: string
  icon?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface PromotionTypeFormData {
  name: string
  description?: string
  icon?: string
  is_active: boolean
}

export interface PromotionItem {
  product_id: string
  quantity: number
}

export interface Promotion {
  id: string
  name: string
  description?: string
  price: number
  image?: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  promotion_type_id: string
  branch_ids: string[]
  items: PromotionItem[]
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface PromotionFormData {
  name: string
  description?: string
  price: number
  image?: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  promotion_type_id: string
  branch_ids: string[]
  items: PromotionItem[]
  is_active: boolean
}
