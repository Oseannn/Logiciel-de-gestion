import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'
export const runtime = 'edge' // Edge runtime est plus rapide pour les cold starts

export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!url || !anonKey) {
      return NextResponse.json({ 
        error: 'Missing Supabase environment variables',
        hasUrl: !!url,
        hasAnonKey: !!anonKey
      }, { status: 500 })
    }
    
    const supabase = createClient(url, anonKey)

    // Récupérer les paramètres
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Requête unique avec JOIN pour être plus rapide
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, sku, brand, category, price, image_url, active,
        product_variants (id, size, color, stock)
      `)
      .order('name')
      .limit(limit)

    if (productsError) {
      return NextResponse.json({ 
        error: productsError.message,
        code: productsError.code,
        duration: Date.now() - startTime
      }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json([])
    }

    // Formater pour garder la compatibilité
    const formatted = products.map((p: any) => ({
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

    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}
