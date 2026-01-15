'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { generateReceiptText, printReceipt, ReceiptSale, ReceiptConfig } from '@/lib/utils/receipt'
import { formatCurrency } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'

interface ReceiptModalProps {
  sale: ReceiptSale
  isOpen: boolean
  onClose: () => void
}

export function ReceiptModal({ sale, isOpen, onClose }: ReceiptModalProps) {
  const [storeConfig, setStoreConfig] = useState<Partial<ReceiptConfig>>({})

  useEffect(() => {
    if (isOpen) {
      loadStoreSettings()
    }
  }, [isOpen])

  const loadStoreSettings = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('settings')
        .select('store_name, logo_url, phone, address, tagline, receipt_footer')
        .single() as { data: { store_name: string | null; logo_url: string | null; phone: string | null; address: string | null; tagline: string | null; receipt_footer: string | null } | null }

      if (data) {
        setStoreConfig({
          storeName: data.store_name || 'Ma Boutique',
          storeTagline: data.tagline || 'Votre Boutique Mode',
          logoUrl: data.logo_url || undefined,
          storePhone: data.phone,
          storeAddress: data.address,
          footerMessage: data.receipt_footer || 'Merci de votre visite !'
        })
      }
    } catch (error) {
      // Utiliser les valeurs par défaut si erreur
      console.log('Using default store config')
    }
  }

  if (!isOpen) return null

  const receiptText = generateReceiptText(sale, storeConfig)

  const handlePrint = () => {
    printReceipt(sale, storeConfig)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Icon name="receipt_long" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Vente Réussie !</h3>
                <p className="text-green-100 text-sm">Ticket N° {sale.id.slice(-8)}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Sale Summary */}
        <div className="p-4 bg-green-50 border-b border-green-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-green-700">Total encaissé</p>
              <p className="text-2xl font-bold text-green-800">{formatCurrency(sale.total)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-700">Mode de paiement</p>
              <p className="font-medium text-green-800">
                {sale.payment_method === 'cash' ? 'Espèces' : 
                 sale.payment_method === 'card' ? 'Carte' : 'Mobile'}
              </p>
            </div>
          </div>
        </div>

        {/* Receipt Preview with Logo */}
        <div className="p-4 max-h-[40vh] overflow-y-auto bg-gray-50">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-inner">
            {/* Logo Preview */}
            {storeConfig.logoUrl && (
              <div className="text-center mb-3 pb-3 border-b border-dashed border-gray-300">
                <img 
                  src={storeConfig.logoUrl} 
                  alt={storeConfig.storeName || 'Logo'} 
                  className="max-h-16 mx-auto object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {receiptText}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="close" className="text-lg" />
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
          >
            <Icon name="print" className="text-lg" />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  )
}
