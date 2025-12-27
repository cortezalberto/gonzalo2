// ============================================
// Restaurant Table Types (Physical Tables)
// ============================================

export type TableStatus = 'libre' | 'solicito_pedido' | 'pedido_cumplido' | 'cuenta_solicitada' | 'ocupada'

export interface RestaurantTable {
  id: string
  branch_id: string
  number: number                   // Table number/identifier within branch
  capacity: number                 // Number of seats/diners
  sector: string                   // Location sector (e.g., "Interior", "Terraza", "VIP")
  status: TableStatus
  order_time: string               // Time of first order (HH:mm format), "00:00" when libre
  close_time: string               // Closing time (HH:mm format), "00:00" when libre
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface RestaurantTableFormData {
  branch_id: string
  number: number
  capacity: number
  sector: string
  status: TableStatus
  order_time: string               // HH:mm format
  close_time: string               // HH:mm format
  is_active: boolean
}

// ============================================
// Order Command Types (Kitchen Commands)
// ============================================

export interface OrderCommandItem {
  product_id: string
  product_name: string             // Snapshot del nombre al momento del pedido
  quantity: number
  unit_price: number               // Precio unitario al momento del pedido
  notes?: string                   // Notas especiales (sin sal, bien cocido, etc.)
}

export interface OrderCommand {
  id: string
  order_history_id: string         // Referencia al historial de la mesa
  items: OrderCommandItem[]
  subtotal: number                 // Suma de (quantity * unit_price)
  created_at: string               // Timestamp de cuando se creo la comanda
  status: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado'
}

export interface OrderHistoryRecord {
  id: string
  branch_id: string
  table_id: string
  table_number: number             // Snapshot del numero de mesa
  date: string                     // Fecha YYYY-MM-DD
  staff_id?: string                // ID del mozo que atendio (opcional por ahora)
  staff_name?: string              // Nombre del mozo (snapshot)
  commands: OrderCommand[]         // Lista de comandas de esta sesion
  order_time: string               // Hora del primer pedido (HH:mm)
  close_time: string | undefined   // Hora de cierre (HH:mm), undefined si aun abierta
  total: number                    // Suma de subtotales de todas las comandas
  status: 'abierta' | 'cerrada'    // Estado del registro
  created_at: string
  updated_at?: string
}
