import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'
export const runtime = 'edge' // Edge runtime est plus rapide

export async function GET(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!url || !anonKey) {
      return NextResponse.json({ 
        error: 'Missing Supabase environment variables'
      }, { status: 500 })
    }
    
    const supabase = createClient(url, anonKey)

    // Paramètres de pagination
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '10')), 50)
    const offset = (page - 1) * limit

    // Compter le total (requête légère)
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    // Récupérer les produits paginés
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, sku, brand, category, price, image_url, active,
        product_variants (id, size, color, stock)
      `)
      .order('name')
      .range(offset, offset + limit - 1)

    if (productsError) {
      return NextResponse.json({ 
        error: productsError.message,
        code: productsError.code
      }, { status: 500 })
    }

    // Formater les produits
    const formatted = (products || []).map((p: any) => ({
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

    // Retourner avec métadonnées de pagination
    return NextResponse.json({
      data: formatted,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0)
      }
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
