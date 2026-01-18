import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (pas de pré-rendu au build)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Timeout plus long pour Vercel
export const maxDuration = 30

// Créer le client Supabase Admin de manière lazy
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-connection-timeout': '20000'
      }
    }
  })
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    
    // Récupérer les paramètres de pagination depuis l'URL
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Requête optimisée avec limite
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, brand, category, price, image_url, active')
      .order('name')
      .range(offset, offset + limit - 1)

    if (productsError) {
      console.error('Error loading products:', productsError)
      return NextResponse.json({ error: productsError.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json([])
    }

    // Récupérer les variantes seulement pour les produits chargés
    const productIds = products.map(p => p.id)
    
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, size, color, stock')
      .in('product_id', productIds)

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
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      hint: 'Check SUPABASE_SERVICE_ROLE_KEY environment variable'
    }, { status: 500 })
  }
}
