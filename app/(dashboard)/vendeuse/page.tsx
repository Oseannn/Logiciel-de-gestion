'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/dashboard/Header'
import { Icon } from '@/components/ui/Icon'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'
import Link from 'next/link'

interface DashboardStats {
  todaySales: number
  todayRevenue: number
  transactionCount: number
  avgCart: number
  cashRegisterOpen: boolean
}

interface RecentSale {
  id: string
  total: number
  created_at: string
  payment_method: string
  client: { first_name: string; last_name: string } | null
  sale_items: { quantity: number; product: { name: string } | null }[]
}

export default function VendeuseDashboard() {
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayRevenue: 0,
    transactionCount: 0,
    avgCart: 0,
    cashRegisterOpen: false
  })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
    
    // Rafraîchissement automatique toutes les 30 secondes
    const interval = setInterval(() => {
      loadData()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single() as { data: { name: string } | null }
    
    if (profile) setUserName(profile.name)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's sales
    const { data: sales } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        created_at,
        payment_method,
        client:clients(first_name, last_name),
        sale_items(quantity, product:products(name))
      `)
      .eq('vendeuse_id', user.id)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false }) as { data: { id: string; total: number; created_at: string; payment_method: string; client: { first_name: string; last_name: string } | null; sale_items: { quantity: number; product: { name: string } | null }[] }[] | null }

    // Check cash register status
    const { data: cashRegister } = await supabase
      .from('cash_register')
      .select('status')
      .eq('vendeuse_id', user.id)
      .eq('status', 'open')
      .single() as { data: { status: string } | null }

    const todayRevenue = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0
    const transactionCount = sales?.length || 0
    const avgCart = transactionCount > 0 ? todayRevenue / transactionCount : 0

    setStats({
      todaySales: transactionCount,
      todayRevenue,
      transactionCount,
      avgCart,
      cashRegisterOpen: !!cashRegister
    })

    setRecentSales((sales || []).slice(0, 5) as RecentSale[])
    setLoading(false)
    setLastUpdate(new Date())
  }

  const formatLastUpdate = () => {
    if (!lastUpdate) return ''
    return lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      <Header 
        title={`Bonjour${userName ? `, ${userName}` : ''} !`} 
        subtitle={lastUpdate ? `Mis à jour à ${formatLastUpdate()}` : 'Prêt pour une excellente journée de vente ?'}
        action={
          <button 
            onClick={() => loadData()} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualiser"
          >
            <Icon name="refresh" className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="p-6 lg:p-8 space-y-8 pb-24 lg:pb-8 animate-fade-in">
        {/* Cash Register Alert */}
        {!stats.cashRegisterOpen && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600">
              <Icon name="warning" className="text-2xl" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-yellow-800">Caisse Fermée</p>
              <p className="text-sm text-yellow-700">Ouvrez la caisse pour commencer à vendre.</p>
            </div>
            <Link 
              href="/vendeuse/caisse" 
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition font-medium"
            >
              Ouvrir la caisse
            </Link>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Bienvenue, {userName || '...'} 👋</h3>
            <p className="text-blue-100 max-w-lg text-sm leading-relaxed">
              Excellente journée de vente ! Continuez sur cette lancée.
            </p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Ventes du jour</p>
                <h4 className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : formatCurrency(stats.todayRevenue)}
                </h4>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon name="payments" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-green-600 bg-green-50 w-fit px-2 py-1 rounded-md">
              <Icon name="arrow_upward" className="text-sm mr-1" /> +12% vs hier
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Transactions</p>
                <h4 className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : stats.transactionCount}
                </h4>
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Icon name="receipt" />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Panier moyen: <span className="font-medium text-gray-700">{formatCurrency(stats.avgCart)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Statut Caisse</p>
                <h4 className={`text-xl font-bold mt-1 ${stats.cashRegisterOpen ? 'text-green-600' : 'text-red-600'}`}>
                  {loading ? '...' : stats.cashRegisterOpen ? 'Ouverte' : 'Fermée'}
                </h4>
              </div>
              <div className={`p-2 rounded-lg ${stats.cashRegisterOpen ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                <Icon name={stats.cashRegisterOpen ? 'lock_open' : 'lock'} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
            <h3 className="font-bold text-gray-800">Activité Récente</h3>
            <Link href="/vendeuse/history" className="text-xs font-medium text-primary hover:underline">
              Tout voir
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Chargement...</div>
            ) : recentSales.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Aucune vente récente</div>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id} className="p-5 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                      <Icon name="shopping_bag" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">
                        #{sale.id.slice(-6)} • {sale.client ? `${sale.client.first_name} ${sale.client.last_name}` : 'Invité'}
                      </p>
                      <div className="text-xs text-gray-500 mt-0.5">
                        <p>{new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • {sale.sale_items.length} articles</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(sale.total)}</p>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      {sale.payment_method === 'cash' ? 'Espèces' : sale.payment_method === 'card' ? 'Carte' : 'Mobile'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/vendeuse/pos"
            className="p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-blue-600 active:scale-95 transition-all text-left"
          >
            <Icon name="add_shopping_cart" className="text-2xl mb-2" />
            <div className="font-bold">Nouvelle Vente</div>
            <div className="text-xs text-blue-100 opacity-80">Accéder au POS</div>
          </Link>
          <Link
            href="/vendeuse/clients"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="person_add" className="text-2xl mb-2 text-purple-500" />
            <div className="font-bold">Nouveau Client</div>
            <div className="text-xs text-gray-400">Créer une fiche</div>
          </Link>
          <Link
            href="/vendeuse/caisse"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="account_balance_wallet" className="text-2xl mb-2 text-green-500" />
            <div className="font-bold">Gérer Caisse</div>
            <div className="text-xs text-gray-400">Ouvrir / Fermer</div>
          </Link>
          <Link
            href="/vendeuse/history"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="history" className="text-2xl mb-2 text-orange-500" />
            <div className="font-bold">Historique</div>
            <div className="text-xs text-gray-400">Voir mes ventes</div>
          </Link>
        </div>
      </div>
    </>
  )
}
