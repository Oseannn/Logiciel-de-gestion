import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const startTime = Date.now()
  const results: any = {
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...'
    },
    tests: []
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(url, key)

    // Test 1: Simple count
    const t1 = Date.now()
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    results.tests.push({
      name: 'COUNT products',
      duration: Date.now() - t1,
      success: !countError,
      count: count,
      error: countError?.message
    })

    // Test 2: Fetch 1 product
    const t2 = Date.now()
    const { data: oneProduct, error: oneError } = await supabase
      .from('products')
      .select('id, name')
      .limit(1)
      .single()
    
    results.tests.push({
      name: 'SELECT 1 product',
      duration: Date.now() - t2,
      success: !oneError,
      data: oneProduct,
      error: oneError?.message
    })

    // Test 3: Fetch all products (no variants)
    const t3 = Date.now()
    const { data: allProducts, error: allError } = await supabase
      .from('products')
      .select('id, name, price')
      .limit(50)
    
    results.tests.push({
      name: 'SELECT 50 products',
      duration: Date.now() - t3,
      success: !allError,
      count: allProducts?.length,
      error: allError?.message
    })

  } catch (error: any) {
    results.exception = error.message
  }

  results.totalDuration = Date.now() - startTime

  return NextResponse.json(results, { status: 200 })
}
