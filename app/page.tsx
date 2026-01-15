import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Get user profile to determine role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (profile) {
      switch (profile.role) {
        case 'admin':
          redirect('/admin')
        case 'manager':
          redirect('/manager')
        case 'vendeuse':
          redirect('/vendeuse')
        default:
          redirect('/login')
      }
    }
  }

  redirect('/login')
}
