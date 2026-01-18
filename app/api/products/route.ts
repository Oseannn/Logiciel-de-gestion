import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  const supabase = createClient(url, key)
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')

  // Requête simple sans JOIN
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, brand, category, price, image_url, active')
    .order('name')
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Récupérer les variantes séparément
  if (data && data.length > 0) {
    const ids = data.map(p => p.id)
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id, size, color, stock')
      .in('product_id', ids)

    const variantMap: Record<string, any[]> = {}
    ;(variants || []).forEach(v => {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = []
      variantMap[v.product_id].push(v)
    })

    const result = data.map(p => ({
      ...p,
      product_variants: variantMap[p.id] || []
    }))

    return NextResponse.json(result)
  }

  return NextResponse.json([])
}
