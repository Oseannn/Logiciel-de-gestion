'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDataCache } from '@/lib/hooks/useDataCache'
import { Icon } from '@/components/ui/Icon'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { ReceiptSale } from '@/lib/utils/receipt'

interface SaleWithDetails {
  id: string
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  status: string
  created_at: string
  client: {
    first_name: string
    last_name: string
  } | null
  sale_items: {
    quantity: number
    price: number
    total: number
    product: {
      name: string
    } | null
    variant: {
      size: string
      color: string
    } | null
  }[]
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<ReceiptSale | null>(null)

  const fetchSales = useCallback(async () => {
    if (!user) return []

    const supabase = createClient()

    let query = supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        status,
        created_at,
        client:clients(first_name, last_name),
        sale_items(
          quantity,
          price,
          total,
          product:products(name),
          variant:product_variants(size, color)
        )
      `)
      .eq('vendeuse_id', user.id)
      .order('created_at', { ascending: false })

    // Apply date filters
    if (filter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    } else if (filter === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      query = query.gte('created_at', weekAgo.toISOString())
    } else if (filter === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      query = query.gte('created_at', monthAgo.toISOString())
    }

    const { data, error } = await query
    if (error) throw error
    return data as SaleWithDetails[]
  }, [user, filter])

  const { data: sales, loading } = useDataCache<SaleWithDetails[]>(
    `vendeuse-history-${user?.id}-${filter}`,
    fetchSales
  )

  const salesData = sales || []

  const handlePrintReceipt = (sale: SaleWithDetails) => {
    const receiptData: ReceiptSale = {
      id: sale.id,
      created_at: sale.created_at,
      total: sale.total,
      payment_method: sale.payment_method,
      vendeuse_name: user?.name || 'Vendeuse',
      client_name: sale.client ? `${sale.client.first_name} ${sale.client.last_name}` : undefined,
      items: sale.sale_items.map(item => ({
        name: item.product?.name || 'Produit',
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }))
    }
    setSelectedSale(receiptData)
    setReceiptModalOpen(true)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Historique des Ventes</h2>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <SkeletonTable rows={8} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8 overflow-y-auto h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Historique des Ventes</h2>
        
        {/* Filter Buttons */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Tout' },
            { key: 'today', label: "Aujourd'hui" },
            { key: 'week', label: '7 jours' },
            { key: 'month', label: '30 jours' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-sm">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Client & Articles</th>
                <th className="p-4 text-right">Montant</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {salesData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <Icon name="receipt_long" className="text-5xl mb-2" />
                    <p>Aucune vente trouvée</p>
                  </td>
                </tr>
              ) : (
                salesData.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <td className="p-4 align-top">
                      <div className="font-mono text-gray-600 text-xs font-bold mb-1">
                        {sale.id.slice(-8)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(sale.created_at).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-medium text-gray-900">
                        {sale.client 
                          ? `${sale.client.first_name} ${sale.client.last_name}` 
                          : 'Passage'
                        }
                      </div>
                      <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded-lg">
                        {sale.sale_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-gray-500">
                            <span className="truncate pr-2">
                              {item.quantity}x {item.product?.name}
                              {item.variant && ` (${item.variant.size}, ${item.variant.color})`}
                            </span>
                            <span>{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 align-top text-right font-bold text-gray-900">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="p-4 align-top text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        sale.status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : sale.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {sale.status === 'completed' 
                          ? `Payé (${sale.payment_method === 'cash' ? 'Espèces' : 
                               sale.payment_method === 'card' ? 'Carte' : 'Mobile'})`
                          : sale.status === 'cancelled'
                          ? 'ANNULÉE'
                          : 'Remboursée'
                        }
                      </span>
                    </td>
                    <td className="p-4 align-top text-center">
                      <button
                        onClick={() => handlePrintReceipt(sale)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                        title="Réimprimer le ticket"
                      >
                        <Icon name="print" className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false)
            setSelectedSale(null)
          }}
        />
      )}
    </div>
  )
}
