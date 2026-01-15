'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { syncService } from '@/lib/offline'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Icon } from '@/components/ui/Icon'
import Link from 'next/link'

const mobileNavItems = [
  { href: '/vendeuse', label: 'Accueil', icon: 'dashboard' },
  { href: '/vendeuse/pos', label: 'Vente', icon: 'point_of_sale' },
  { href: '/vendeuse/history', label: 'Historique', icon: 'receipt_long' },
  { href: '/vendeuse/clients', label: 'Clients', icon: 'group' },
]

export default function VendeuseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('User')
  const [loading, setLoading] = useState(true)
  const checkedRef = useRef(false)
  const syncInitRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single() as { data: { name: string; role: string } | null }

      if (!profile || profile.role !== 'vendeuse') {
        router.push('/login')
        return
      }

      setUserName(profile.name || 'User')
      setLoading(false)

      // Initialiser la synchronisation automatique
      if (!syncInitRef.current && syncService) {
        syncInitRef.current = true
        syncService.startAutoSync(30000) // Sync toutes les 30 secondes
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bgLight flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bgLight text-slate-800 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Navigation (Bottom) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 z-50 flex justify-around p-3 pb-safe">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center ${isActive ? 'text-primary' : 'text-gray-400'}`}
            >
              <Icon name={item.icon} />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Sidebar (Desktop) */}
      <Sidebar role="vendeuse" userName={userName} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-bgLight">
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  )
}
