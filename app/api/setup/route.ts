import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Forcer le rendu dynamique (pas de pré-rendu au build)
export const dynamic = 'force-dynamic'

// Use service role to create the first admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  try {
    // Check if any admin exists
    const { data: admins, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (error) {
      console.error('Error checking admins:', error)
      return NextResponse.json({ needsSetup: true })
    }

    return NextResponse.json({ 
      needsSetup: !admins || admins.length === 0 
    })
  } catch (error) {
    console.error('Setup check error:', error)
    return NextResponse.json({ needsSetup: true })
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password, storeName } = await request.json()

    // Validate input
    if (!name || !email || !password || !storeName) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      )
    }

    // Check if admin already exists
    const { data: existingAdmins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json(
        { error: 'Un compte administrateur existe déjà' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erreur lors de la création du compte' },
        { status: 500 }
      )
    }

    // Create or update profile (trigger may have created one with default role)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        name,
        role: 'admin',
        status: 'active',
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile error:', profileError)
      // Try to delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Erreur lors de la création du profil' },
        { status: 500 }
      )
    }

    // Create or update settings with store name
    // First check if settings exist
    const { data: existingSettings } = await supabaseAdmin
      .from('settings')
      .select('id')
      .limit(1)
      .single()

    if (existingSettings) {
      // Update existing settings
      await supabaseAdmin
        .from('settings')
        .update({
          store_name: storeName,
          currency: 'XAF',
          tax_rate: 0,
        })
        .eq('id', existingSettings.id)
    } else {
      // Insert new settings
      await supabaseAdmin
        .from('settings')
        .insert({
          store_name: storeName,
          currency: 'XAF',
          tax_rate: 0,
        })
    }

    const settingsError = null

    if (settingsError) {
      console.error('Settings error:', settingsError)
      // Non-blocking, continue anyway
    }

    return NextResponse.json({ 
      success: true,
      message: 'Compte administrateur créé avec succès'
    })
  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
