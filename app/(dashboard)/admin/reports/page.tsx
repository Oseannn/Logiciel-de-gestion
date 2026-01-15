'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { useDataCache } from '@/lib/hooks/useDataCache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { ExportButton } from '@/components/admin/ExportButton'
import { CancelSaleModal } from '@/components/admin/CancelSaleModal'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'
import toast from 'react-hot-toast'

interface SaleWithDetails {
  id: string
  total: number
  payment_method: string
  status: string
  created_at: string
  vendeuse_id: string | null
  client_id: string | null
  vendeuse: { name: string } | null
  client: { first_name: string; last_name: string } | null
  sale_items: {
    quantity: number
    price: number
    total: number
    product: { name: string } | null
  }[]
}

type Period = 'day' | 'week' | 'month' | 'year'

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null)

  const supabase = createClient()
  const supabaseUntyped = createUntypedClient()

  const getDateFilter = (p: Period): Date => {
    const now = new Date()
    switch (p) {
      case 'day':
        now.setHours(0, 0, 0, 0)
        return now
      case 'week':
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        now.setDate(diff)
        now.setHours(0, 0, 0, 0)
        return now
      case 'month':
        now.setDate(1)
        now.setHours(0, 0, 0, 0)
        return now
      case 'year':
        now.setMonth(0, 1)
        now.setHours(0, 0, 0, 0)
        return now
    }
  }

  const fetchSales = useCallback(async () => {
    const startDate = getDateFilter(period)
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        status,
        created_at,
        vendeuse_id,
        client_id,
        vendeuse:profiles!sales_vendeuse_id_fkey(name),
        client:clients(first_name, last_name),
        sale_items(
          quantity,
          price,
          total,
          product:products(name)
        )
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as SaleWithDetails[]
  }, [period])

  const { data: sales, loading, refresh: refreshSales, mutate } = useDataCache<SaleWithDetails[]>(
    `admin-reports-${period}`,
    fetchSales
  )

  // Calculate stats
  const salesData = sales || []
  const completedSales = salesData.filter(s => s.status === 'completed')
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0)
  const salesCount = completedSales.length
  const avgCart = salesCount > 0 ? totalRevenue / salesCount : 0

  // Payment methods breakdown
  const paymentMethods = { cash: 0, card: 0, mobile: 0 }
  completedSales.forEach(s => {
    const method = s.payment_method as keyof typeof paymentMethods
    if (paymentMethods[method] !== undefined) {
      paymentMethods[method] += s.total
    }
  })

  // Best product
  const productStats: Record<string, { name: string; qty: number; revenue: number }> = {}
  completedSales.forEach(sale => {
    sale.sale_items.forEach(item => {
      const name = item.product?.name || 'Inconnu'
      if (!productStats[name]) {
        productStats[name] = { name, qty: 0, revenue: 0 }
      }
      productStats[name].qty += item.quantity
      productStats[name].revenue += item.total
    })
  })
  const bestProduct = Object.values(productStats).sort((a, b) => b.qty - a.qty)[0]

  // Best client
  const clientStats: Record<string, { name: string; total: number; count: number }> = {}
  completedSales.forEach(sale => {
    if (sale.client) {
      const name = `${sale.client.first_name} ${sale.client.last_name}`
      if (!clientStats[name]) {
        clientStats[name] = { name, total: 0, count: 0 }
      }
      clientStats[name].total += sale.total
      clientStats[name].count++
    }
  })
  const bestClient = Object.values(clientStats).sort((a, b) => b.total - a.total)[0]

  const handleCancelSale = async (reason: string) => {
    if (!selectedSale) return

    // Sauvegarde pour rollback
    const previousSales = sales || []
    
    // Mise à jour optimiste immédiate
    mutate((prev) => (prev || []).map(s => 
      s.id === selectedSale.id ? { ...s, status: 'cancelled' } : s
    ))

    try {
      // Update sale status
      const { error: saleError } = await supabaseUntyped
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', selectedSale.id)

      if (saleError) {
        console.error('Sale update error:', saleError)
        // Rollback
        mutate(previousSales)
        throw saleError
      }

      // Create refund record
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error: refundError } = await supabaseUntyped
        .from('refunds')
        .insert({
          sale_id: selectedSale.id,
          refund_amount: selectedSale.total,
          reason,
          type: 'FULL',
          refunded_by: user?.id
        })

      if (refundError) {
        console.error('Refund error:', refundError)
        // Continue even if refund record fails
      }

      // Log audit
      const { error: auditError } = await supabaseUntyped
        .from('audit_logs')
        .insert({
          user_id: user?.id,
          action: `Annulation vente #${selectedSale.id.slice(-8)}`,
          category: 'cancel',
          details: {
            sale_id: selectedSale.id,
            total: selectedSale.total,
            reason,
            client: selectedSale.client 
              ? `${selectedSale.client.first_name} ${selectedSale.client.last_name}`
              : 'Anonyme'
          }
        })

      if (auditError) {
        console.error('Audit log error:', auditError)
      }

      toast.success('Vente annulée avec succès')
      setCancelModalOpen(false)
      setSelectedSale(null)
    } catch (error: any) {
      console.error('Error cancelling sale:', error)
      toast.error('Erreur lors de l\'annulation: ' + (error.message || 'Erreur inconnue'))
      throw error
    }
  }

  const periodLabels: Record<Period, string> = {
    day: "Aujourd'hui",
    week: 'Cette Semaine',
    month: 'Ce Mois',
    year: 'Cette Année'
  }

  const exportData = salesData.map(s => ({
    id: s.id,
    created_at: s.created_at,
    vendeuse_name: s.vendeuse?.name,
    client_name: s.client ? `${s.client.first_name} ${s.client.last_name}` : undefined,
    items: s.sale_items.map(i => ({ quantity: i.quantity, name: i.product?.name || 'Inconnu' })),
    payment_method: s.payment_method,
    total: s.total
  }))

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Rapports & Statistiques</h1>
          <p className="text-gray-600 mt-1">Analysez les performances de vente</p>
        </div>
        <ExportButton
          data={exportData}
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
          filename={`rapport_ventes_${period}_${new Date().toISOString().slice(0, 10)}.csv`}
          label="Exporter Excel"
        />
      </div>

      {/* Period Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
            {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  period === p
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon name="payments" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Chiffre d'Affaires</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Icon name="shopping_cart" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Nombre de Ventes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{salesCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Icon name="star" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Meilleur Article</p>
            <div className="mt-1">
              <p className="text-lg font-bold text-gray-900 truncate">
                {bestProduct?.name || '-'}
              </p>
              <p className="text-xs text-gray-400">
                {bestProduct ? `${bestProduct.qty} vendus` : 'Aucune donnée'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                <Icon name="person_celebrate" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Meilleur Client</p>
            <div className="mt-1">
              <p className="text-lg font-bold text-gray-900 truncate">
                {bestClient?.name || '-'}
              </p>
              <p className="text-xs text-gray-400">
                {bestClient ? formatCurrency(bestClient.total) : 'Aucune donnée'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Méthodes de Paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600">Espèces</span>
                </div>
                <span className="font-bold">{formatCurrency(paymentMethods.cash)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-600">Carte</span>
                </div>
                <span className="font-bold">{formatCurrency(paymentMethods.card)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm text-gray-600">Mobile</span>
                </div>
                <span className="font-bold">{formatCurrency(paymentMethods.mobile)}</span>
              </div>
            </div>

            {/* Simple bar chart */}
            <div className="mt-6 space-y-2">
              {totalRevenue > 0 && (
                <>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-green-500 h-full" 
                      style={{ width: `${(paymentMethods.cash / totalRevenue) * 100}%` }}
                    />
                    <div 
                      className="bg-blue-500 h-full" 
                      style={{ width: `${(paymentMethods.card / totalRevenue) * 100}%` }}
                    />
                    <div 
                      className="bg-purple-500 h-full" 
                      style={{ width: `${(paymentMethods.mobile / totalRevenue) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transactions de la Période ({salesData.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={8} />
              </div>
            ) : salesData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Aucune vente</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Statut</th>
                      <th className="px-6 py-3 text-right">Montant</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesData.slice(0, 20).map((sale) => {
                      const isCancelled = sale.status === 'cancelled'
                      return (
                        <tr key={sale.id} className={isCancelled ? 'bg-gray-50 opacity-75' : ''}>
                          <td className="px-6 py-3 text-gray-500 text-xs">
                            {formatDateTime(sale.created_at)}
                          </td>
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {sale.client 
                              ? `${sale.client.first_name} ${sale.client.last_name}`
                              : 'Anonyme'}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={isCancelled ? 'danger' : 'success'}>
                              {isCancelled ? 'Annulée' : 'Complétée'}
                            </Badge>
                          </td>
                          <td className={`px-6 py-3 text-right font-medium ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {!isCancelled && (
                              <button
                                onClick={() => {
                                  setSelectedSale(sale)
                                  setCancelModalOpen(true)
                                }}
                                className="text-red-500 hover:text-red-700 text-xs font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors"
                              >
                                Annuler
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Sale Modal */}
      {selectedSale && (
        <CancelSaleModal
          sale={{
            id: selectedSale.id,
            total: selectedSale.total,
            created_at: selectedSale.created_at,
            client_name: selectedSale.client 
              ? `${selectedSale.client.first_name} ${selectedSale.client.last_name}`
              : undefined,
            vendeuse_name: selectedSale.vendeuse?.name,
            payment_method: selectedSale.payment_method
          }}
          isOpen={cancelModalOpen}
          onClose={() => {
            setCancelModalOpen(false)
            setSelectedSale(null)
          }}
          onConfirm={handleCancelSale}
        />
      )}
    </div>
  )
}
