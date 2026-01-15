'use client'

import { useEffect, useState } from 'react'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { Header } from '@/components/dashboard/Header'
import { Icon } from '@/components/ui/Icon'
import { formatCurrency } from '@/lib/utils/currency'
import Link from 'next/link'

interface DashboardStats {
  totalSales: number
  totalRevenue: number       // CA du jour
  totalWithdrawals: number   // Sorties de caisse du jour
  cashInDrawer: number       // Solde en caisse du jour
  totalProducts: number
  lowStockProducts: number
}

export default function ManagerDashboard() {
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalWithdrawals: 0,
    cashInDrawer: 0,
    totalProducts: 0,
    lowStockProducts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const supabase = createClient()
    const supabaseUntyped = createUntypedClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get profile
    const { data: profile } = await supabaseUntyped
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
    
    if (profile) setUserName(profile.name)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's completed sales
    const { data: sales } = await supabaseUntyped
      .from('sales')
      .select('total, payment_method')
      .eq('status', 'completed')
      .gte('created_at', today.toISOString())

    // Get today's cash withdrawals
    const { data: withdrawals } = await supabaseUntyped
      .from('cash_withdrawals')
      .select('amount')
      .gte('created_at', today.toISOString())

    // Get products count
    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)

    // Get low stock variants
    const { data: lowStock } = await supabase
      .from('product_variants')
      .select('id')
      .lt('stock', 5)

    // Calculs
    const totalRevenue = sales?.reduce((sum: number, sale: any) => sum + Number(sale.total), 0) || 0
    const totalWithdrawals = withdrawals?.reduce((sum: number, w: any) => sum + Number(w.amount), 0) || 0
    
    // Solde en caisse = ventes en espèces du jour - sorties de caisse du jour
    const cashSales = sales?.filter((s: any) => s.payment_method === 'cash')
      .reduce((sum: number, sale: any) => sum + Number(sale.total), 0) || 0
    const cashInDrawer = cashSales - totalWithdrawals

    setStats({
      totalSales: sales?.length || 0,
      totalRevenue,
      totalWithdrawals,
      cashInDrawer,
      totalProducts: productsCount || 0,
      lowStockProducts: lowStock?.length || 0
    })
    setLoading(false)
  }

  return (
    <>
      <Header 
        title={`Bonjour${userName ? `, ${userName}` : ''} !`} 
        subtitle="Vue d'ensemble de votre boutique" 
      />

      <div className="p-6 lg:p-8 space-y-8 pb-24 lg:pb-8 animate-fade-in">
        {/* Alert for low stock */}
        {stats.lowStockProducts > 0 && !loading && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
              <Icon name="warning" className="text-2xl" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-orange-800">Stock faible</p>
              <p className="text-sm text-orange-700">{stats.lowStockProducts} produit(s) avec un stock inférieur à 5 unités.</p>
            </div>
            <Link 
              href="/manager/products" 
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
            >
              Voir les produits
            </Link>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Bienvenue, {userName || '...'} 👋</h3>
            <p className="text-blue-100 max-w-lg text-sm leading-relaxed">
              Gérez vos produits et suivez les performances de votre équipe.
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
                  {loading ? '...' : stats.totalSales}
                </h4>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon name="shopping_bag" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Chiffre d'Affaires</p>
                <h4 className="text-2xl font-bold text-green-600 mt-1">
                  {loading ? '...' : formatCurrency(stats.totalRevenue)}
                </h4>
                <p className="text-xs text-gray-400 mt-1">Total des ventes du jour</p>
              </div>
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <Icon name="payments" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Sorties de Caisse</p>
                <h4 className="text-2xl font-bold text-orange-600 mt-1">
                  {loading ? '...' : formatCurrency(stats.totalWithdrawals)}
                </h4>
                <p className="text-xs text-gray-400 mt-1">Retraits du jour</p>
              </div>
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Icon name="money_off" />
              </div>
            </div>
          </div>
        </div>

        {/* Second row of KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Produits actifs</p>
                <h4 className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? '...' : stats.totalProducts}
                </h4>
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Icon name="inventory_2" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Stock faible</p>
                <h4 className={`text-2xl font-bold mt-1 ${stats.lowStockProducts > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {loading ? '...' : stats.lowStockProducts}
                </h4>
              </div>
              <div className={`p-2 rounded-lg ${stats.lowStockProducts > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                <Icon name={stats.lowStockProducts > 0 ? 'warning' : 'check_circle'} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/manager/products"
            className="p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-blue-600 active:scale-95 transition-all text-left"
          >
            <Icon name="inventory_2" className="text-2xl mb-2" />
            <div className="font-bold">Produits</div>
            <div className="text-xs text-blue-100 opacity-80">Gérer le catalogue</div>
          </Link>
          <Link
            href="/manager/sales"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="analytics" className="text-2xl mb-2 text-green-500" />
            <div className="font-bold">Ventes</div>
            <div className="text-xs text-gray-400">Voir les statistiques</div>
          </Link>
          <Link
            href="/manager/products"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="add_box" className="text-2xl mb-2 text-purple-500" />
            <div className="font-bold">Nouveau Produit</div>
            <div className="text-xs text-gray-400">Ajouter au catalogue</div>
          </Link>
          <Link
            href="/manager/sales"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="bar_chart" className="text-2xl mb-2 text-orange-500" />
            <div className="font-bold">Rapports</div>
            <div className="text-xs text-gray-400">Analyser les données</div>
          </Link>
        </div>
      </div>
    </>
  )
}
