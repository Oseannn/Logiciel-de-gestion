'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/Icon'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'
import toast from 'react-hot-toast'

interface CashRegister {
  id: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at?: string
  opened_by_name?: string
  initial_amount: number
  sales_total: number
  current_amount: number
  final_amount?: number
  expected_amount?: number
  difference?: number
}

interface Withdrawal {
  id: string
  amount: number
  reason: string
  created_at: string
  user_name?: string
}

interface CashHistory {
  id: string
  opened_at: string
  closed_at: string
  initial_amount: number
  sales_total: number
  final_amount: number
  expected_amount: number
  difference: number
  withdrawals_total: number
}

export default function CaissePage() {
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [cashHistory, setCashHistory] = useState<CashHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [initialAmount, setInitialAmount] = useState('')
  const [finalAmount, setFinalAmount] = useState('')
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [userName, setUserName] = useState('')
  const [historyPeriod, setHistoryPeriod] = useState<'7' | '30' | '90'>('7')
  
  const router = useRouter()
  const supabase = createClient()
  const supabaseUntyped = createUntypedClient()

  useEffect(() => {
    loadCashRegister()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadCashHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPeriod])

  const loadCashRegister = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      
      if (profile) setUserName((profile as any).name || user.email || '')

      const { data, error } = await supabase
        .from('cash_register')
        .select('*')
        .eq('vendeuse_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        const cashData = data as any
        // Calculate current_amount from initial + sales - withdrawals
        const { data: withdrawalsData } = await supabase
          .from('cash_withdrawals')
          .select('amount')
          .eq('cash_register_id', cashData.id)

        const totalWithdrawals = (withdrawalsData || []).reduce((sum: number, w: any) => sum + w.amount, 0)
        const currentAmount = cashData.initial_amount + (cashData.sales_total || 0) - totalWithdrawals

        setCashRegister({ 
          ...cashData, 
          current_amount: currentAmount,
          opened_by_name: userName 
        })

        // Load withdrawals
        const { data: fullWithdrawalsData } = await supabase
          .from('cash_withdrawals')
          .select('*')
          .eq('cash_register_id', cashData.id)
          .order('created_at', { ascending: false })

        setWithdrawals((fullWithdrawalsData as Withdrawal[]) || [])
      } else {
        setCashRegister(null)
      }
    } catch (error: any) {
      console.error('Error loading cash register:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCashHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const days = parseInt(historyPeriod)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)

      const { data, error } = await supabaseUntyped
        .from('cash_register')
        .select('id, opened_at, closed_at, initial_amount, sales_total, final_amount, expected_amount, difference')
        .eq('vendeuse_id', user.id)
        .eq('status', 'closed')
        .gte('closed_at', startDate.toISOString())
        .order('closed_at', { ascending: false })

      if (error) {
        console.error('Error loading cash history:', error)
        return
      }

      // Load withdrawals for each cash register
      const historyWithWithdrawals = await Promise.all(
        (data || []).map(async (cr: any) => {
          const { data: withdrawalsData } = await supabaseUntyped
            .from('cash_withdrawals')
            .select('amount')
            .eq('cash_register_id', cr.id)

          const withdrawalsTotal = (withdrawalsData || []).reduce((sum: number, w: any) => sum + w.amount, 0)
          return { ...cr, withdrawals_total: withdrawalsTotal }
        })
      )

      setCashHistory(historyWithWithdrawals as CashHistory[])
    } catch (error) {
      console.error('Error loading cash history:', error)
    }
  }

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(initialAmount)

    if (isNaN(amount) || amount < 0) {
      toast.error('Montant invalide')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Non authentifié')
        return
      }

      console.log('Opening cash register for user:', user.id)

      const { data, error } = await supabase
        .from('cash_register')
        .insert({
          vendeuse_id: user.id,
          status: 'open',
          opened_at: new Date().toISOString(),
          initial_amount: amount,
          sales_total: 0,
        } as any)
        .select()
        .single()

      if (error) {
        console.error('Cash register error:', error)
        throw new Error(error.message)
      }

      if (!data) {
        throw new Error('Caisse non créée')
      }

      console.log('Cash register opened:', (data as any).id)

      // Add current_amount for local state
      setCashRegister({ ...(data as any), current_amount: amount, opened_by_name: userName })
      setInitialAmount('')
      toast.success('Caisse ouverte avec succès !')
    } catch (error: any) {
      console.error('Error opening cash:', error)
      toast.error(error.message || 'Erreur lors de l\'ouverture')
    }
  }

  const handleCloseCash = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashRegister) return

    const amount = parseFloat(finalAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Montant invalide')
      return
    }

    const withdrawalsTotal = withdrawals.reduce((sum, w) => sum + w.amount, 0)
    const expected = cashRegister.initial_amount + cashRegister.sales_total - withdrawalsTotal
    const difference = amount - expected

    const diffText = difference === 0 
      ? 'Aucun écart' 
      : difference > 0 
        ? `Excédent de ${formatCurrency(difference)}` 
        : `Manque de ${formatCurrency(Math.abs(difference))}`

    if (!confirm(`Montant attendu: ${formatCurrency(expected)}\nMontant réel: ${formatCurrency(amount)}\n${diffText}\n\nConfirmer la fermeture ?`)) {
      return
    }

    try {
      const { error } = await supabaseUntyped
        .from('cash_register')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_amount: amount,
          expected_amount: expected,
          difference,
        })
        .eq('id', cashRegister.id)

      if (error) throw error

      toast.success('Caisse fermée avec succès !')
      setCashRegister(null)
      setWithdrawals([])
      setFinalAmount('')
      loadCashHistory() // Refresh history after closing
    } catch (error: any) {
      console.error('Error closing cash:', error)
      toast.error('Erreur lors de la fermeture')
    }
  }

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cashRegister) return

    const amount = parseFloat(withdrawalAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      return
    }

    if (!withdrawalReason.trim()) {
      toast.error('Le motif est obligatoire')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: newWithdrawal, error: withdrawalError } = await supabase
        .from('cash_withdrawals')
        .insert({
          cash_register_id: cashRegister.id,
          amount,
          reason: withdrawalReason,
          created_by: user.id,
        } as any)
        .select()
        .single()

      if (withdrawalError) throw withdrawalError

      const newCurrentAmount = cashRegister.current_amount - amount
      
      setCashRegister({ ...cashRegister, current_amount: newCurrentAmount })
      setWithdrawals([{ ...(newWithdrawal as any), user_name: userName }, ...withdrawals])
      toast.success('Sortie de caisse enregistrée')
      setWithdrawalAmount('')
      setWithdrawalReason('')
    } catch (error: any) {
      console.error('Error processing withdrawal:', error)
      toast.error('Erreur lors du retrait')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  const withdrawalsTotal = withdrawals.reduce((sum, w) => sum + w.amount, 0)
  const isOpen = cashRegister && cashRegister.status === 'open'

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8 overflow-y-auto h-full">
      {/* Status Banner */}
      <div className={`bg-white rounded-2xl p-6 shadow-sm border ${isOpen ? 'border-green-200' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${isOpen ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'} flex items-center justify-center`}>
              <Icon name={isOpen ? 'point_of_sale' : 'lock'} className="text-3xl" />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${isOpen ? 'text-green-700' : 'text-gray-700'}`}>
                {isOpen ? 'Caisse Ouverte' : 'Caisse Fermée'}
              </h3>
              <p className="text-sm text-gray-500">
                {isOpen 
                  ? `Ouverte le ${formatDateTime(cashRegister.opened_at)}${cashRegister.opened_by_name ? ` par ${cashRegister.opened_by_name}` : ''}`
                  : 'Ouvrez la caisse pour commencer'
                }
              </p>
            </div>
          </div>
          {isOpen && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Montant actuel</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(cashRegister.current_amount)}</p>
            </div>
          )}
        </div>
      </div>

      {!isOpen ? (
        /* Open Cash Register Form */
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Ouvrir la Caisse</h3>
          <form onSubmit={handleOpenCash} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant initial</label>
              <input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                min="0"
                step="100"
                required
                className="w-full rounded-xl border-gray-300 border px-4 py-3 text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Ex: 50000"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="lock_open" />
              Ouvrir la Caisse
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Montant Initial</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(cashRegister.initial_amount)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Ventes du Jour</p>
              <p className="text-xl font-bold text-green-600 mt-1">+{formatCurrency(cashRegister.sales_total)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Sorties</p>
              <p className="text-xl font-bold text-red-600 mt-1">-{formatCurrency(withdrawalsTotal)}</p>
            </div>
          </div>

          {/* Withdrawal Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Sortie de Caisse</h3>
            <form onSubmit={handleWithdrawal} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                <input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  min="1"
                  required
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Montant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motif *</label>
                <input
                  type="text"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  required
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Raison de la sortie"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="remove_circle" className="text-lg" />
                  Retirer
                </button>
              </div>
            </form>
          </div>

          {/* Withdrawals List */}
          {withdrawals.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Sorties de Caisse</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {withdrawals.map((w) => (
                  <div key={w.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{w.reason}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(w.created_at).toLocaleTimeString('fr-FR')}
                        {w.user_name && ` • ${w.user_name}`}
                      </p>
                    </div>
                    <span className="font-bold text-red-600">-{formatCurrency(w.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Close Cash Register */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Fermer la Caisse</h3>
            <form onSubmit={handleCloseCash} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant final en caisse</label>
                <input
                  type="number"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  min="0"
                  step="100"
                  required
                  className="w-full rounded-xl border-gray-300 border px-4 py-3 text-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Comptez l'argent en caisse"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="lock" />
                Fermer la Caisse
              </button>
            </form>
          </div>
        </>
      )}

      {/* Cash History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Icon name="history" className="text-gray-500" />
            Historique des Caisses
          </h3>
          <select
            value={historyPeriod}
            onChange={(e) => setHistoryPeriod(e.target.value as '7' | '30' | '90')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
        </div>
        {cashHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Icon name="inbox" className="text-4xl mb-2" />
            <p>Aucun historique sur cette période</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Initial</th>
                  <th className="px-4 py-3 text-right">Ventes</th>
                  <th className="px-4 py-3 text-right">Sorties</th>
                  <th className="px-4 py-3 text-right">Final</th>
                  <th className="px-4 py-3 text-right">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cashHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {new Date(h.closed_at).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(h.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(h.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(h.initial_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      +{formatCurrency(h.sales_total || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {h.withdrawals_total > 0 ? `-${formatCurrency(h.withdrawals_total)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatCurrency(h.final_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.difference === 0 
                          ? 'bg-green-100 text-green-700' 
                          : h.difference > 0 
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {h.difference === 0 ? 'OK' : h.difference > 0 ? `+${formatCurrency(h.difference)}` : formatCurrency(h.difference)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
