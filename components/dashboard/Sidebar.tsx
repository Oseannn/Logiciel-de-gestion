'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'

interface NavItem {
  href: string
  label: string
  icon: string
}

interface SidebarProps {
  role: 'admin' | 'manager' | 'vendeuse'
  userName: string
  userAvatar?: string
}

const navItems: Record<string, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { href: '/admin/team', label: 'Performance Équipe', icon: 'trending_up' },
    { href: '/admin/reports', label: 'Rapports', icon: 'bar_chart' },
    { href: '/admin/users', label: 'Utilisateurs', icon: 'group' },
    { href: '/admin/products', label: 'Produits', icon: 'inventory_2' },
    { href: '/admin/clients', label: 'Clients', icon: 'groups' },
    { href: '/admin/caisse', label: 'Supervision Caisse', icon: 'point_of_sale' },
    { href: '/admin/settings', label: 'Paramètres', icon: 'settings' },
  ],
  manager: [
    { href: '/manager', label: 'Vue d\'ensemble', icon: 'dashboard' },
    { href: '/manager/products', label: 'Produits & Stock', icon: 'inventory_2' },
    { href: '/manager/sales', label: 'Ventes', icon: 'payments' },
    { href: '/manager/clients', label: 'Clients', icon: 'groups' },
  ],
  vendeuse: [
    { href: '/vendeuse', label: 'Mon Dashboard', icon: 'dashboard' },
    { href: '/vendeuse/pos', label: 'Nouvelle Vente', icon: 'point_of_sale' },
    { href: '/vendeuse/history', label: 'Mes Ventes', icon: 'receipt_long' },
    { href: '/vendeuse/caisse', label: 'Caisse', icon: 'account_balance_wallet' },
    { href: '/vendeuse/clients', label: 'Mes Clientes', icon: 'group' },
  ],
}

export function Sidebar({ role, userName, userAvatar }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const items = navItems[role] || []

  const handleLogout = async () => {
    const supabase = createClient()
    const supabaseUntyped = createUntypedClient()
    
    // Récupérer l'utilisateur actuel
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Enregistrer la déconnexion et mettre à jour le statut (non-bloquant)
      supabaseUntyped.from('user_sessions').insert({
        user_id: user.id,
        action: 'logout'
      })
      
      supabaseUntyped.from('profiles').update({
        is_online: false,
        last_seen: new Date().toISOString()
      }).eq('id', user.id)
    }
    
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarUrl = userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`

  return (
    <aside className="w-20 lg:w-64 bg-white border-r border-gray-200 hidden md:flex flex-col z-20 transition-all duration-300">
      {/* Logo */}
      <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-100">
        <Image 
          src="/icons/icon-96x96.png" 
          alt="RetailOS" 
          width={40} 
          height={40} 
          className="rounded-xl shadow-lg"
        />
        <h1 className="hidden lg:block ml-3 text-lg font-bold tracking-tight">RetailOS</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 px-2 lg:px-4 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'w-full flex items-center justify-center lg:justify-start px-2 lg:px-4 py-3 text-sm font-medium rounded-xl transition-all group relative',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon name={item.icon} className="text-2xl" />
              <span className="hidden lg:block ml-3">{item.label}</span>
              {/* Tooltip for collapsed state */}
              <div className="absolute left-16 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 lg:hidden pointer-events-none transition-opacity z-50 whitespace-nowrap">
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Profile Brief */}
      <div className="p-4 border-t border-gray-100 flex flex-col items-center lg:items-stretch">
        <div className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors w-full">
          <img 
            src={avatarUrl} 
            alt={userName} 
            className="w-10 h-10 rounded-full border border-gray-200"
          />
          <div className="hidden lg:block min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-green-600 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span> 
              En ligne
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center lg:justify-start px-4 py-2 text-sm font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        >
          <Icon name="logout" className="lg:mr-2" />
          <span className="hidden lg:inline">Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
