import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabase = createClient(url, key)
    
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50)
    const offset = (page - 1) * limit

    // Requête 1: Produits seulement (rapide)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, brand, category, price, image_url, active')
      .order('name')
      .range(offset, offset + limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ data: [], pagination: { page, limit, hasMore: false } })
    }

    // Requête 2: Variantes pour ces produits
    const ids = products.map(p => p.id)
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id, size, color, stock')
      .in('product_id', ids)

    // Mapper les variantes par produit
    const variantMap: Record<string, any[]> = {}
    ;(variants || []).forEach((v: any) => {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = []
      variantMap[v.product_id].push({ id: v.id, size: v.size, color: v.color, stock: v.stock })
    })

    // Combiner
    const result = products.map(p => ({
      ...p,
      product_variants: variantMap[p.id] || []
    }))

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        hasMore: products.length > limit
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
