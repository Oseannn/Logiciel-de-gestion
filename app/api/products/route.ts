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

    // Une seule requête avec JOIN
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, brand, category, price, image_url, active,
        product_variants (id, size, color, stock)
      `)
      .order('name')
      .range(offset, offset + limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const products = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      category: p.category,
      price: p.price,
      image_url: p.image_url,
      active: p.active,
      product_variants: p.product_variants || []
    }))

    // Format avec pagination simple
    const hasMore = products.length > limit
    
    return NextResponse.json({
      data: hasMore ? products.slice(0, limit) : products,
      pagination: {
        page,
        limit,
        hasMore
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
