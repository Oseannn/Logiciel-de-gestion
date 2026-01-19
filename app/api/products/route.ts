import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

// Client réutilisable
let supabase: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    supabase = createClient(url, key)
  }
  return supabase
}

export async function GET(request: Request) {
  try {
    const client = getSupabase()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100)
    const offset = (page - 1) * limit

    // UNE SEULE requête avec jointure
    const { data, error } = await client
      .from('products')
      .select(`
        id, name, sku, brand, category, price, image_url, active,
        product_variants (id, size, color, stock)
      `)
      .order('name')
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      pagination: { page, limit, hasMore: (data?.length || 0) === limit }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
