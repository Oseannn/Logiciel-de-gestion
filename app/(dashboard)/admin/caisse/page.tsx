'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDataCache } from '@/lib/hooks/useDataCache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'

interface CashRegisterEntry {
  id: string
  status: string
  opened_at: string
  closed_at: string | null
  initial_amount: number
  final_amount: number | null
  expected_amount: number | null
  difference: number | null
  sales_total: number
  vendeuse_id: string
  vendeuse: { name: string } | null
  cash_withdrawals: {
    id: string
    amount: number
    reason: string
    created_at: string
  }[]
}

export default function CaissePage() {
  const supabase = createClient()

  const fetchCashHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('cash_register')
      .select(`
        id,
        status,
        opened_at,
        closed_at,
        initial_amount,
        final_amount,
        expected_amount,
        difference,
        sales_total,
        vendeuse_id,
        vendeuse:profiles!cash_register_vendeuse_id_fkey(name),
        cash_withdrawals(
          id,
          amount,
          reason,
          created_at
        )
      `)
      .order('opened_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data as CashRegisterEntry[]
  }, [])

  const { data: entries, loading } = useDataCache<CashRegisterEntry[]>(
    'admin-caisse',
    fetchCashHistory
  )

  const entriesData = entries || []

  // Calculate stats
  const totalDiscrepancy = entriesData
    .filter(e => e.status === 'closed' && e.difference !== null)
    .reduce((sum, e) => sum + (e.difference || 0), 0)

  const totalWithdrawals = entriesData.reduce((sum, e) => 
    sum + e.cash_withdrawals.reduce((wSum, w) => wSum + w.amount, 0), 0
  )

  const openRegisters = entriesData.filter(e => e.status === 'open').length
  const closedRegisters = entriesData.filter(e => e.status === 'closed').length

  const operations: {
    type: 'OPEN' | 'CLOSE' | 'WITHDRAWAL'
    date: string
    userName: string
    initialAmount?: number
    finalAmount?: number
    difference?: number
    reason?: string
    amount?: number
  }[] = []

  entriesData.forEach(entry => {
    // Opening
    operations.push({
      type: 'OPEN',
      date: entry.opened_at,
      userName: entry.vendeuse?.name || 'Inconnu',
      initialAmount: entry.initial_amount
    })

    // Withdrawals
    entry.cash_withdrawals.forEach(w => {
      operations.push({
        type: 'WITHDRAWAL',
        date: w.created_at,
        userName: entry.vendeuse?.name || 'Inconnu',
        amount: w.amount,
        reason: w.reason
      })
    })

    // Closing
    if (entry.status === 'closed' && entry.closed_at) {
      operations.push({
        type: 'CLOSE',
        date: entry.closed_at,
        userName: entry.vendeuse?.name || 'Inconnu',
        finalAmount: entry.final_amount || 0,
        difference: entry.difference || 0
      })
    }
  })

  // Sort by date descending
  operations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Supervision Caisse</h1>
        <p className="text-gray-600 mt-1">Historique des opérations de caisse</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <Icon name="lock_open" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Caisses Ouvertes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{openRegisters}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <Icon name="lock" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Caisses Fermées</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{closedRegisters}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Icon name="payments" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Total Retraits</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalWithdrawals)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${totalDiscrepancy < 0 ? 'bg-red-50 text-red-600' : totalDiscrepancy > 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'}`}>
                <Icon name="balance" className="text-xl" />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">Écart Total</p>
            <p className={`text-2xl font-bold mt-1 ${totalDiscrepancy < 0 ? 'text-red-600' : totalDiscrepancy > 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(totalDiscrepancy)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Opérations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={8} />
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune opération de caisse enregistrée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3">Date/Heure</th>
                    <th className="px-6 py-3">Utilisateur</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3 text-center">Montant Initial</th>
                    <th className="px-6 py-3 text-center">Montant Final</th>
                    <th className="px-6 py-3 text-center">Écart</th>
                    <th className="px-6 py-3">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {operations.map((op, idx) => {
                    let badgeVariant: 'success' | 'danger' | 'warning' = 'success'
                    let actionText = ''
                    let icon = ''

                    if (op.type === 'OPEN') {
                      badgeVariant = 'success'
                      actionText = 'OUVERTURE'
                      icon = 'lock_open'
                    } else if (op.type === 'CLOSE') {
                      badgeVariant = 'danger'
                      actionText = 'FERMETURE'
                      icon = 'lock'
                    } else {
                      badgeVariant = 'warning'
                      actionText = 'RETRAIT'
                      icon = 'payments'
                    }

                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-xs text-gray-500">
                          <div className="font-medium text-gray-900">
                            {new Date(op.date).toLocaleDateString('fr-FR')}
                          </div>
                          <div>{new Date(op.date).toLocaleTimeString('fr-FR')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {op.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{op.userName}</div>
                              <div className="text-xs text-gray-400">Vendeuse</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={badgeVariant}>
                            <Icon name={icon} className="text-sm mr-1" />
                            {actionText}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-gray-900">
                          {op.type === 'OPEN' ? formatCurrency(op.initialAmount || 0) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-gray-900">
                          {op.type === 'CLOSE' ? formatCurrency(op.finalAmount || 0) : 
                           op.type === 'WITHDRAWAL' ? formatCurrency(op.amount || 0) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center font-bold">
                          {op.type === 'CLOSE' && op.difference !== undefined ? (
                            <span className={op.difference < 0 ? 'text-red-600' : op.difference > 0 ? 'text-green-600' : 'text-gray-500'}>
                              {formatCurrency(op.difference)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {op.type === 'OPEN' && 'Ouverture de caisse'}
                          {op.type === 'CLOSE' && 'Fermeture de caisse'}
                          {op.type === 'WITHDRAWAL' && (
                            <span>
                              <span className="font-medium text-orange-700">Motif:</span> {op.reason || 'Non spécifié'}
                            </span>
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
  )
}
