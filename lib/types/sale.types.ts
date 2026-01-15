export interface SaleItem {
  id: string
  sale_id: string
  product_id: string | null
  variant_id: string | null
  quantity: number
  price: number
  total: number
  product_name?: string
  variant_details?: string
}

export interface Sale {
  id: string
  vendeuse_id: string | null
  client_id: string | null
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  status: 'completed' | 'cancelled' | 'partially_refunded'
  created_at: string
  items?: SaleItem[]
  vendeuse_name?: string
  client_name?: string
}

export interface CreateSaleData {
  vendeuse_id: string
  client_id?: string | null
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  items: {
    product_id: string
    variant_id?: string | null
    quantity: number
    price: number
    total: number
  }[]
}
