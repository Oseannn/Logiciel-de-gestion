export interface ProductVariant {
  id: string
  product_id: string
  size: string
  color: string
  stock: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  brand: string | null
  category: string
  price: number
  image_url: string | null
  active: boolean
  created_at: string
  updated_at: string
  variants?: ProductVariant[]
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[]
}
