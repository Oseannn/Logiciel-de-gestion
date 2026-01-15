'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/Icon'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime, formatDate } from '@/lib/utils/date'
import toast from 'react-hot-toast'

interface Vendeuse {
  id: string
  name: string
  email: string
  avatar_url: string | null
  total_sales: number
  total_amount: number
  avg_sale: number
}

interface Sale {
  id: string
  created_at: string
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  status: string
  client_name: string | null
  items: SaleItem[]
}

interface SaleItem {
  id: string
  product_name: string
  quantity: number
  price: number
  total: number
  variant_info?: string
}

export default function TeamPerformancePage() {
  const [vendeuses, setVendeuses] = useState<Vendeuse[]>([])
  const [selectedVendeuse, setSelectedVendeuse] = useState<Vendeuse | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSales, setLoadingSales] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1) // Premier jour du mois
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadVendeuses()
  }, [dateFrom, dateTo])

  const loadVendeuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Charger toutes les vendeuses
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .eq('role', 'vendeuse')
        .eq('status', 'active') as { data: { id: string; name: string; email: string; avatar_url: string | null }[] | null; error: any }

      if (profilesError) throw profilesError

      // Charger les stats de ventes pour chaque vendeuse
      const vendeuseStats: Vendeuse[] = []

      for (const profile of profiles || []) {
        const { data: salesData } = await supabase
          .from('sales')
          .select('total')
          .eq('vendeuse_id', profile.id)
          .eq('status', 'completed')
          .gte('created_at', `${dateFrom}T00:00:00`)
          .lte('created_at', `${dateTo}T23:59:59`) as { data: { total: number }[] | null }

        const totalSales = salesData?.length || 0
        const totalAmount = salesData?.reduce((sum, s) => sum + s.total, 0) || 0
        const avgSale = totalSales > 0 ? totalAmount / totalSales : 0

        vendeuseStats.push({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          total_sales: totalSales,
          total_amount: totalAmount,
          avg_sale: avgSale
        })
      }

      // Trier par montant total décroissant
      vendeuseStats.sort((a, b) => b.total_amount - a.total_amount)
      setVendeuses(vendeuseStats)

    } catch (error: any) {
      console.error('Error loading vendeuses:', error)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const loadVendeuseSales = async (vendeuse: Vendeuse) => {
    setSelectedVendeuse(vendeuse)
    setLoadingSales(true)
    setSelectedSale(null)

    try {
      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          total,
          payment_method,
          status,
          client_id
        `)
        .eq('vendeuse_id', vendeuse.id)
        .eq('status', 'completed')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false }) as { data: { id: string; created_at: string; total: number; payment_method: string; status: string; client_id: string | null }[] | null; error: any }

      if (error) throw error

      // Charger les détails pour chaque vente
      const salesWithDetails: Sale[] = []

      for (const sale of salesData || []) {
        // Charger le nom du client
        let clientName = null
        if (sale.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('first_name, last_name')
            .eq('id', sale.client_id)
            .single() as { data: { first_name: string; last_name: string } | null }
          
          if (client) {
            clientName = `${client.first_name} ${client.last_name}`
          }
        }

        // Charger les articles
        const { data: itemsData } = await supabase
          .from('sale_items')
          .select(`
            id,
            quantity,
            price,
            total,
            product_id,
            variant_id
          `)
          .eq('sale_id', sale.id) as { data: { id: string; quantity: number; price: number; total: number; product_id: string | null; variant_id: string | null }[] | null }

        const items: SaleItem[] = []
        for (const item of itemsData || []) {
          let productName = 'Produit inconnu'
          let variantInfo = ''

          if (item.product_id) {
            const { data: product } = await supabase
              .from('products')
              .select('name')
              .eq('id', item.product_id)
              .single() as { data: { name: string } | null }
            
            if (product) productName = product.name
          }

          if (item.variant_id) {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('size, color')
              .eq('id', item.variant_id)
              .single() as { data: { size: string; color: string } | null }
            
            if (variant) {
              variantInfo = `${variant.size} / ${variant.color}`
            }
          }

          items.push({
            id: item.id,
            product_name: productName,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            variant_info: variantInfo
          })
        }

        salesWithDetails.push({
          id: sale.id,
          created_at: sale.created_at,
          total: sale.total,
          payment_method: sale.payment_method as 'cash' | 'card' | 'mobile',
          status: sale.status,
          client_name: clientName,
          items
        })
      }

      setSales(salesWithDetails)

    } catch (error: any) {
      console.error('Error loading sales:', error)
      toast.error('Erreur de chargement des ventes')
    } finally {
      setLoadingSales(false)
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      card: 'Carte',
      mobile: 'Mobile'
    }
    return labels[method] || method
  }

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, string> = {
      cash: 'payments',
      card: 'credit_card',
      mobile: 'smartphone'
    }
    return icons[method] || 'payment'
  }

  // Calcul des totaux globaux
  const totalGlobalSales = vendeuses.reduce((sum, v) => sum + v.total_sales, 0)
  const totalGlobalAmount = vendeuses.reduce((sum, v) => sum + v.total_amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement des performances...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance d'Équipe</h1>
          <p className="text-gray-500">Suivi détaillé des ventes par vendeuse</p>
        </div>
        
        {/* Filtres de date */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* KPIs Globaux */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Icon name="group" className="text-2xl text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Vendeuses Actives</p>
              <p className="text-2xl font-bold text-gray-900">{vendeuses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <Icon name="receipt_long" className="text-2xl text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Ventes</p>
              <p className="text-2xl font-bold text-gray-900">{totalGlobalSales}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <Icon name="payments" className="text-2xl text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalGlobalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des vendeuses */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Icon name="leaderboard" className="text-primary" />
              Classement
            </h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {vendeuses.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Icon name="person_off" className="text-4xl mb-2" />
                <p>Aucune vendeuse trouvée</p>
              </div>
            ) : (
              vendeuses.map((v, index) => (
                <button
                  key={v.id}
                  onClick={() => loadVendeuseSales(v)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedVendeuse?.id === v.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {index < 3 && (
                        <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                        }`}>
                          {index + 1}
                        </div>
                      )}
                      <img
                        src={v.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}&background=random`}
                        alt={v.name}
                        className="w-12 h-12 rounded-full border-2 border-gray-200"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{v.name}</p>
                      <p className="text-xs text-gray-500">{v.total_sales} ventes</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(v.total_amount)}</p>
                      <p className="text-xs text-gray-500">Moy: {formatCurrency(v.avg_sale)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Détail des ventes */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedVendeuse ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <Icon name="touch_app" className="text-6xl text-gray-300 mb-4" />
              <p className="text-gray-500">Sélectionnez une vendeuse pour voir ses ventes</p>
            </div>
          ) : (
            <>
              {/* Info vendeuse sélectionnée */}
              <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedVendeuse.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedVendeuse.name)}&background=random`}
                    alt={selectedVendeuse.name}
                    className="w-16 h-16 rounded-full border-4 border-white/30"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{selectedVendeuse.name}</h3>
                    <p className="text-blue-100">{selectedVendeuse.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{formatCurrency(selectedVendeuse.total_amount)}</p>
                    <p className="text-blue-100">{selectedVendeuse.total_sales} ventes</p>
                  </div>
                </div>
              </div>

              {/* Liste des ventes */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Historique des Ventes</h3>
                  <span className="text-sm text-gray-500">{sales.length} ventes</span>
                </div>

                {loadingSales ? (
                  <div className="p-8 text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-gray-500">Chargement...</p>
                  </div>
                ) : sales.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Icon name="receipt" className="text-4xl mb-2" />
                    <p>Aucune vente sur cette période</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    {sales.map((sale) => (
                      <div key={sale.id} className="p-4">
                        <button
                          onClick={() => setSelectedSale(selectedSale?.id === sale.id ? null : sale)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                sale.payment_method === 'cash' ? 'bg-green-50 text-green-600' :
                                sale.payment_method === 'card' ? 'bg-blue-50 text-blue-600' :
                                'bg-purple-50 text-purple-600'
                              }`}>
                                <Icon name={getPaymentMethodIcon(sale.payment_method)} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  Ticket #{sale.id.slice(-8)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDateTime(sale.created_at)}
                                  {sale.client_name && ` • ${sale.client_name}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="font-bold text-gray-900">{formatCurrency(sale.total)}</p>
                                <p className="text-xs text-gray-500">{sale.items.length} article(s)</p>
                              </div>
                              <Icon 
                                name={selectedSale?.id === sale.id ? 'expand_less' : 'expand_more'} 
                                className="text-gray-400"
                              />
                            </div>
                          </div>
                        </button>

                        {/* Détail de la facture */}
                        {selectedSale?.id === sale.id && (
                          <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                              <Icon name="receipt_long" className="text-primary" />
                              Détail de la facture
                            </h4>
                            <div className="space-y-2">
                              {sale.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{item.product_name}</p>
                                    {item.variant_info && (
                                      <p className="text-xs text-gray-500">{item.variant_info}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600">
                                      {item.quantity} x {formatCurrency(item.price)}
                                    </p>
                                    <p className="font-semibold text-gray-900">{formatCurrency(item.total)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t-2 border-gray-300 flex justify-between items-center">
                              <span className="font-bold text-gray-700">TOTAL</span>
                              <span className="text-xl font-bold text-primary">{formatCurrency(sale.total)}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                              <Icon name={getPaymentMethodIcon(sale.payment_method)} className="text-lg" />
                              <span>Payé par {getPaymentMethodLabel(sale.payment_method)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
