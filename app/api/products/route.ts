import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Utiliser service_role si disponible, sinon anon key
    const key = serviceKey || anonKey
    
    if (!url || !key) {
      return NextResponse.json({ 
        error: 'Missing Supabase environment variables',
        hasUrl: !!url,
        hasServiceKey: !!serviceKey,
        hasAnonKey: !!anonKey
      }, { status: 500 })
    }
    
    const supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Récupérer les paramètres de pagination
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log(`[Products API] Fetching products with limit=${limit}, offset=${offset}`)

    // Requête simple et rapide
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, brand, category, price, image_url, active')
      .order('name')
      .range(offset, offset + limit - 1)

    if (productsError) {
      console.error('[Products API] Error:', productsError)
      return NextResponse.json({ 
        error: productsError.message,
        code: productsError.code,
        details: productsError.details,
        duration: Date.now() - startTime
      }, { status: 500 })
    }

    if (!products || products.length === 0) {
      console.log('[Products API] No products found')
      return NextResponse.json([])
    }

    console.log(`[Products API] Found ${products.length} products in ${Date.now() - startTime}ms`)

    // Récupérer les variantes
    const productIds = products.map(p => p.id)
    
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, product_id, size, color, stock')
      .in('product_id', productIds)

    if (variantsError) {
      console.error('[Products API] Variants error:', variantsError)
    }

    console.log(`[Products API] Found ${variants?.length || 0} variants in ${Date.now() - startTime}ms`)

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

    console.log(`[Products API] Total duration: ${Date.now() - startTime}ms`)

    return NextResponse.json(productsWithVariants)
  } catch (error: any) {
    console.error('[Products API] Exception:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}
