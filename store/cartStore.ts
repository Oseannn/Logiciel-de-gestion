import { create } from 'zustand'
import { Client } from '@/lib/types/client.types'

interface CartItem {
  id: string
  product_id: string
  variant_id?: string | null
  name: string
  price: number
  quantity: number
  variant_details?: string
  image_url?: string | null
}

interface Discount {
  type: 'percentage' | 'fixed'
  value: number
  reason?: string
}

interface CartStore {
  items: CartItem[]
  client: Client | null
  paymentMethod: 'cash' | 'card' | 'mobile'
  discount: Discount | null
  
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  setClient: (client: Client | null) => void
  setPaymentMethod: (method: 'cash' | 'card' | 'mobile') => void
  setDiscount: (discount: Discount | null) => void
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  client: null,
  paymentMethod: 'cash',
  discount: null,

  addItem: (item) => {
    const items = get().items
    const existingItem = items.find(
      (i) => i.product_id === item.product_id && i.variant_id === item.variant_id
    )

    if (existingItem) {
      set({
        items: items.map((i) =>
          i.id === existingItem.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      })
    } else {
      set({
        items: [...items, { ...item, quantity: 1 }],
      })
    }
  },

  removeItem: (id) => {
    set({ items: get().items.filter((i) => i.id !== id) })
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id)
    } else {
      set({
        items: get().items.map((i) =>
          i.id === id ? { ...i, quantity } : i
        ),
      })
    }
  },

  clearCart: () => {
    set({ items: [], client: null, paymentMethod: 'cash', discount: null })
  },

  setClient: (client) => {
    set({ client })
  },

  setPaymentMethod: (method) => {
    set({ paymentMethod: method })
  },

  setDiscount: (discount) => {
    set({ discount })
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  getDiscountAmount: () => {
    const discount = get().discount
    if (!discount) return 0
    
    const subtotal = get().getSubtotal()
    if (discount.type === 'percentage') {
      return Math.round(subtotal * (discount.value / 100))
    }
    return Math.min(discount.value, subtotal)
  },

  getTotal: () => {
    return get().getSubtotal() - get().getDiscountAmount()
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0)
  },
}))
