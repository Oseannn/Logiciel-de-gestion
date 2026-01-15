'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

interface Sale {
  id: string
  total: number
  created_at: string
  client_name?: string
  vendeuse_name?: string
  payment_method: string
}

interface CancelSaleModalProps {
  sale: Sale
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

export function CancelSaleModal({ sale, isOpen, onClose, onConfirm }: CancelSaleModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!reason.trim()) {
      alert('Veuillez indiquer un motif d\'annulation')
      return
    }

    setLoading(true)
    try {
      await onConfirm(reason)
      setReason('')
      onClose()
    } catch (error) {
      console.error('Error cancelling sale:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-6 flex items-center gap-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <Icon name="warning" className="text-2xl" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Annuler cette vente ?</h3>
            <p className="text-sm text-gray-500">Cette action est irréversible</p>
          </div>
        </div>

        {/* Sale Details */}
        <div className="mx-6 bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">ID Vente:</span>
            <span className="font-mono text-gray-700">{sale.id.slice(-8)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Client:</span>
            <span className="text-gray-700">{sale.client_name || 'Anonyme'}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Vendeuse:</span>
            <span className="text-gray-700">{sale.vendeuse_name || 'N/A'}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Date:</span>
            <span className="text-gray-700">{formatDateTime(sale.created_at)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Paiement:</span>
            <span className="text-gray-700">
              {sale.payment_method === 'cash' ? 'Espèces' : 
               sale.payment_method === 'card' ? 'Carte' : 'Mobile'}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
            <span className="text-gray-500">Montant:</span>
            <span className="text-gray-900">{formatCurrency(sale.total)}</span>
          </div>
        </div>

        {/* Reason Input */}
        <div className="mx-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motif de l'annulation *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-xl border-gray-300 border px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            placeholder="Ex: Erreur de saisie, demande client, produit défectueux..."
          />
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Icon name="delete" />
                Confirmer l'annulation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
