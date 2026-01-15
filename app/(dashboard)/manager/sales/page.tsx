'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDataCache } from '@/lib/hooks/useDataCache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ExportButton } from '@/components/admin/ExportButton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

interface SaleItem {
  id: string
  quantity: number
  price: number
  total: number
  product_name: string
  variant_info?: string
}

interface SaleWithDetails {
  id: string
  total: number
  payment_method: string
  status: string
  created_at: string
  vendeuse_id: string | null
  vendeuse_name: string
  client_name: string | null
  items: SaleItem[]
}

export default function SalesReportPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('month')
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null)

  const supabase = createClient()

  const fetchSales = useCallback(async () => {
    // Build date filter
    let startDate: Date | null = null
    if (filter === 'today') {
      startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
    } else if (filter === 'week') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
    } else if (filter === 'month') {
      startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 1)
    }

    // Load sales
    let query = supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        status,
        created_at,
        vendeuse_id,
        client_id
      `)
      .order('created_at', { ascending: false })

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data: salesData, error: salesError } = await query as { data: { id: string; total: number; payment_method: string; status: string; created_at: string; vendeuse_id: string | null; client_id: string | null }[] | null; error: any }

    if (salesError) throw salesError

    // Load additional data for each sale
    const salesWithDetails: SaleWithDetails[] = []

    for (const sale of salesData || []) {
      // Get vendeuse name
      let vendeuseName = 'Inconnu'
      if (sale.vendeuse_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', sale.vendeuse_id)
          .single() as { data: { name: string } | null }
        if (profile) vendeuseName = profile.name
      }

      // Get client name
      let clientName = null
      if (sale.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('first_name, last_name')
          .eq('id', sale.client_id)
          .single() as { data: { first_name: string; last_name: string } | null }
        if (client) clientName = `${client.first_name} ${client.last_name}`
      }

      // Get sale items
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('id, quantity, price, total, product_id, variant_id')
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
          if (variant) variantInfo = `${variant.size} / ${variant.color}`
        }

        items.push({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          product_name: productName,
          variant_info: variantInfo
        })
      }

      salesWithDetails.push({
        id: sale.id,
        total: sale.total,
        payment_method: sale.payment_method,
        status: sale.status,
        created_at: sale.created_at,
        vendeuse_id: sale.vendeuse_id,
        vendeuse_name: vendeuseName,
        client_name: clientName,
        items
      })
    }

    return salesWithDetails
  }, [filter])

  const { data: sales, loading } = useDataCache<SaleWithDetails[]>(
    `manager-sales-${filter}`,
    fetchSales
  )

  const salesData = sales || []

  const filteredSales = salesData.filter(sale => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      sale.id.toLowerCase().includes(search) ||
      sale.vendeuse_name.toLowerCase().includes(search) ||
      sale.client_name?.toLowerCase().includes(search)
    )
  })

  // Stats
  const completedSales = filteredSales.filter(s => s.status === 'completed')
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0)
  const avgSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0
  const totalItems = completedSales.reduce((sum, s) => 
    sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  )

  // Vendeuse stats
  const vendeuseStats = new Map<string, { name: string; sales: number; amount: number }>()
  completedSales.forEach(sale => {
    const key = sale.vendeuse_id || 'unknown'
    if (!vendeuseStats.has(key)) {
      vendeuseStats.set(key, { name: sale.vendeuse_name, sales: 0, amount: 0 })
    }
    const stats = vendeuseStats.get(key)!
    stats.sales++
    stats.amount += sale.total
  })

  const getPaymentIcon = (method: string) => {
    const icons: Record<string, string> = {
      cash: 'payments',
      card: 'credit_card',
      mobile: 'smartphone'
    }
    return icons[method] || 'payment'
  }

  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      card: 'Carte',
      mobile: 'Mobile'
    }
    return labels[method] || method
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Rapports de Ventes</h1>
          <p className="text-gray-600 mt-2">Analysez les performances de vente</p>
        </div>
        <ExportButton
          data={filteredSales.map(s => ({
            id: s.id,
            created_at: s.created_at,
            vendeuse_name: s.vendeuse_name,
            client_name: s.client_name,
            items: s.items.map(i => ({ quantity: i.quantity, name: i.product_name })),
            payment_method: s.payment_method,
            total: s.total
          }))}
          headers={['ID', 'Date', 'Heure', 'Vendeuse', 'Client', 'Articles', 'Paiement', 'Total']}
          formatRow={(s) => [
            s.id,
            new Date(s.created_at).toLocaleDateString('fr-FR'),
            new Date(s.created_at).toLocaleTimeString('fr-FR'),
            s.vendeuse_name || 'N/A',
            s.client_name || 'Anonyme',
            s.items.map(i => `${i.quantity}x ${i.name}`).join('; '),
            s.payment_method,
            String(s.total)
          ]}
          filename={`rapport_ventes_${filter}_${new Date().toISOString().slice(0, 10)}.csv`}
          label="Exporter CSV"
        />
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Icon name="receipt_long" className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{completedSales.length}</div>
                <p className="text-sm text-gray-600">Total Ventes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Icon name="payments" className="text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Icon name="shopping_cart" className="text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(avgSale)}</div>
                <p className="text-sm text-gray-600">Panier Moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <Icon name="inventory_2" className="text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalItems}</div>
                <p className="text-sm text-gray-600">Articles Vendus</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendeuse Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance par Vendeuse</CardTitle>
        </CardHeader>
        <CardContent>
          {vendeuseStats.size === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucune donnée</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from(vendeuseStats.values())
                .sort((a, b) => b.amount - a.amount)
                .map((stats, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-300'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-gray-900">{stats.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{stats.sales} ventes</span>
                      <span className="font-bold text-green-600">{formatCurrency(stats.amount)}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Rechercher par ID, vendeuse ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'today', 'week', 'month'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filter === f ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'Tout' : f === 'today' ? "Aujourd'hui" : f === 'week' ? '7 jours' : '30 jours'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des Ventes ({filteredSales.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><SkeletonTable rows={8} /></div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icon name="receipt" className="text-4xl mb-2" />
              <p>Aucune vente trouvée</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="p-4">
                  <button
                    onClick={() => setSelectedSale(selectedSale?.id === sale.id ? null : sale)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          sale.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                          sale.payment_method === 'cash' ? 'bg-green-50 text-green-600' :
                          sale.payment_method === 'card' ? 'bg-blue-50 text-blue-600' :
                          'bg-purple-50 text-purple-600'
                        }`}>
                          <Icon name={sale.status === 'cancelled' ? 'cancel' : getPaymentIcon(sale.payment_method)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">#{sale.id.slice(-8)}</span>
                            {sale.status === 'cancelled' && (
                              <Badge variant="danger">Annulée</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatDateTime(sale.created_at)} • {sale.vendeuse_name}
                            {sale.client_name && ` • ${sale.client_name}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-bold ${sale.status === 'cancelled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {formatCurrency(sale.total)}
                          </p>
                          <p className="text-xs text-gray-500">{sale.items.length} article(s)</p>
                        </div>
                        <Icon 
                          name={selectedSale?.id === sale.id ? 'expand_less' : 'expand_more'} 
                          className="text-gray-400"
                        />
                      </div>
                    </div>
                  </button>

                  {/* Sale Details */}
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
                        <Icon name={getPaymentIcon(sale.payment_method)} className="text-lg" />
                        <span>Payé par {getPaymentLabel(sale.payment_method)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
