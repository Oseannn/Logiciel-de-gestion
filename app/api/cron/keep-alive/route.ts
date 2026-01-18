import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Ce endpoint est appelé par Vercel Cron toutes les 5 minutes
// pour garder la base Supabase "chaude" et éviter les cold starts

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // Vérifier le secret pour sécuriser l'endpoint (optionnel)
  const authHeader = request.headers.get('authorization')
  
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabase = createClient(url, key)
    
    // Simple requête pour garder la connexion active
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database kept alive',
      productCount: count,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
