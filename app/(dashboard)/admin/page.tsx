'use client'

import { useEffect, useState } from 'react'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { Header } from '@/components/dashboard/Header'
import { Icon } from '@/components/ui/Icon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/currency'
import Link from 'next/link'

interface DashboardStats {
  totalSales: number
  totalRevenue: number
  todaySales: number
  todayRevenue: number
  totalWithdrawals: number
  cancelledSales: number
}

interface DailySales {
  date: string
  salesCount: number
  revenue: number
}

export default function AdminDashboard() {
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalRevenue: 0,
    todaySales: 0,
    todayRevenue: 0,
    totalWithdrawals: 0,
    cancelledSales: 0
  })
  const [dailySales, setDailySales] = useState<DailySales[]>([])
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

    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all completed sales
    const { data: allSales } = await supabaseUntyped
      .from('sales')
      .select('total, created_at, status')
      .order('created_at', { ascending: false })

    // Get cancelled sales count
    const cancelledSales = allSales?.filter((s: any) => s.status === 'cancelled').length || 0

    // Filter completed sales
    const completedSales = allSales?.filter((s: any) => s.status === 'completed') || []

    // Calculate total revenue
    const totalRevenue = completedSales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0)

    // Calculate today's sales
    const todaySalesData = completedSales.filter((s: any) => {
      const saleDate = new Date(s.created_at)
      saleDate.setHours(0, 0, 0, 0)
      return saleDate.getTime() === today.getTime()
    })
    const todayRevenue = todaySalesData.reduce((sum: number, sale: any) => sum + Number(sale.total), 0)

    // Get withdrawals
    const { data: withdrawals } = await supabaseUntyped
      .from('cash_withdrawals')
      .select('amount')

    const totalWithdrawals = withdrawals?.reduce((sum: number, w: any) => sum + Number(w.amount), 0) || 0

    // Calculate daily sales for the last 7 days
    const dailySalesMap = new Map<string, { count: number; revenue: number }>()
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dateStr = date.toISOString().split('T')[0]
      dailySalesMap.set(dateStr, { count: 0, revenue: 0 })
    }

    // Fill with actual data
    completedSales.forEach((sale: any) => {
      const saleDate = new Date(sale.created_at)
      const dateStr = saleDate.toISOString().split('T')[0]
      if (dailySalesMap.has(dateStr)) {
        const current = dailySalesMap.get(dateStr)!
        dailySalesMap.set(dateStr, {
          count: current.count + 1,
          revenue: current.revenue + Number(sale.total)
        })
      }
    })

    // Convert to array
    const dailySalesArray: DailySales[] = Array.from(dailySalesMap.entries()).map(([date, data]) => ({
      date,
      salesCount: data.count,
      revenue: data.revenue
    }))

    setStats({
      totalSales: completedSales.length,
      totalRevenue,
      todaySales: todaySalesData.length,
      todayRevenue,
      totalWithdrawals,
      cancelledSales
    })
    setDailySales(dailySalesArray)
    setLoading(false)
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.getTime() === today.getTime()) return "Aujourd'hui"
    if (date.getTime() === yesterday.getTime()) return "Hier"
    
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <>
      <Header 
        title={`Bonjour${userName ? `, ${userName}` : ''} !`} 
        subtitle="Vue d'ensemble du système" 
      />

      <div className="p-6 lg:p-8 space-y-8 pb-24 lg:pb-8 animate-fade-in">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Bienvenue, {userName || '...'} 👋</h3>
            <p className="text-blue-100 max-w-lg text-sm leading-relaxed">
              Gérez les utilisateurs et surveillez l'activité du système.
            </p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Ventes du Jour</p>
                <h4 className="text-2xl font-bold text-blue-600 mt-1">
                  {loading ? '...' : stats.todaySales}
                </h4>
                <p className="text-xs text-gray-400 mt-1">transactions</p>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon name="today" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">CA du Jour</p>
                <h4 className="text-2xl font-bold text-green-600 mt-1">
                  {loading ? '...' : formatCurrency(stats.todayRevenue)}
                </h4>
                <p className="text-xs text-gray-400 mt-1">encaissé aujourd'hui</p>
              </div>
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <Icon name="payments" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">CA Total</p>
                <h4 className="text-2xl font-bold text-purple-600 mt-1">
                  {loading ? '...' : formatCurrency(stats.totalRevenue)}
                </h4>
                <p className="text-xs text-gray-400 mt-1">{stats.totalSales} ventes</p>
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Icon name="account_balance" />
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
                <p className="text-xs text-gray-400 mt-1">retraits effectués</p>
              </div>
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Icon name="money_off" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/reports"
            className="p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-blue-600 active:scale-95 transition-all text-left"
          >
            <Icon name="bar_chart" className="text-2xl mb-2" />
            <div className="font-bold">Rapports</div>
            <div className="text-xs text-blue-100 opacity-80">Voir les détails</div>
          </Link>
          <Link
            href="/admin/users"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="group" className="text-2xl mb-2 text-purple-500" />
            <div className="font-bold">Utilisateurs</div>
            <div className="text-xs text-gray-400">Gérer les comptes</div>
          </Link>
          <Link
            href="/admin/team"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="trending_up" className="text-2xl mb-2 text-green-500" />
            <div className="font-bold">Performance</div>
            <div className="text-xs text-gray-400">Équipe de vente</div>
          </Link>
          <Link
            href="/admin/caisse"
            className="p-4 bg-white text-gray-700 border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all text-left"
          >
            <Icon name="point_of_sale" className="text-2xl mb-2 text-orange-500" />
            <div className="font-bold">Caisses</div>
            <div className="text-xs text-gray-400">Supervision</div>
          </Link>
        </div>

        {/* Daily Sales History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="calendar_month" className="text-primary" />
              Historique des Ventes (7 derniers jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : (
              <div className="space-y-3">
                {dailySales.map((day, index) => (
                  <div 
                    key={day.date} 
                    className={`flex items-center justify-between p-4 rounded-xl ${
                      index === dailySales.length - 1 
                        ? 'bg-blue-50 border-2 border-blue-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        index === dailySales.length - 1 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        <Icon name="calendar_today" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{formatDateLabel(day.date)}</p>
                        <p className="text-sm text-gray-500">{day.salesCount} vente(s)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        day.revenue > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {formatCurrency(day.revenue)}
                      </p>
                      {day.salesCount > 0 && (
                        <p className="text-xs text-gray-400">
                          Moy: {formatCurrency(day.revenue / day.salesCount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
