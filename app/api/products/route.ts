import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Missing Supabase environment variables' }, { status: 500 })
    }

    const supabase = createClient(url, anonKey)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10')), 50)
    const offset = (page - 1) * limit

    // Produits uniquement
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

    // Variantes pour les produits présents
    const ids = products.map(p => p.id)
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id, size, color, stock')
      .in('product_id', ids)

    const variantMap: Record<string, any[]> = {}
    ;(variants || []).forEach((v: any) => {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = []
      variantMap[v.product_id].push({ id: v.id, size: v.size, color: v.color, stock: v.stock })
    })

    const result = products.map(p => ({
      ...p,
      product_variants: variantMap[p.id] || []
    }))

    const hasMore = result.length > limit

    return NextResponse.json({
      data: hasMore ? result.slice(0, limit) : result,
      pagination: { page, limit, hasMore }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
