import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Utiliser le service role key pour contourner RLS et avoir plus de permissions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET() {
  try {
    // Requête 1: Récupérer les produits
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, brand, category, price, image_url, active')
      .order('name')

    if (productsError) {
      console.error('Error loading products:', productsError)
      return NextResponse.json({ error: productsError.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json([])
    }

    // Requête 2: Récupérer les variantes
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, size, color, stock')

    if (variantsError) {
      console.error('Error loading variants:', variantsError)
    }

    // Combiner les données
    const variantsByProduct = (variants || []).reduce((acc: Record<string, any[]>, v) => {
      if (!acc[v.product_id]) acc[v.product_id] = []
      acc[v.product_id].push({ id: v.id, size: v.size, color: v.color, stock: v.stock })
      return acc
    }, {})

    const productsWithVariants = products.map(p => ({
      ...p,
      product_variants: variantsByProduct[p.id] || []
    }))

    return NextResponse.json(productsWithVariants)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
