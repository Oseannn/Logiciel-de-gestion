'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils/currency'
import { Icon } from '@/components/ui/Icon'
import toast from 'react-hot-toast'

export function Cart() {
  const { 
    items, paymentMethod, discount,
    removeItem, updateQuantity, setPaymentMethod, clearCart, setDiscount,
    getSubtotal, getDiscountAmount, getTotal 
  } = useCartStore()
  
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')

  const subtotal = getSubtotal()
  const discountAmount = getDiscountAmount()
  const total = getTotal()

  const handleClearCart = () => {
    if (items.length === 0) return
    if (confirm(`Vider le panier ? (${items.length} article${items.length > 1 ? 's' : ''})`)) {
      clearCart()
      toast.success('Panier vidé')
    }
  }

  const handleRemoveItem = (itemId: string, itemName: string) => {
    removeItem(itemId)
    toast.success(`${itemName} retiré`, { duration: 1500, icon: '🗑️' })
  }

  const handleApplyDiscount = () => {
    const value = parseFloat(discountValue)
    if (isNaN(value) || value <= 0) {
      toast.error('Valeur invalide')
      return
    }
    if (discountType === 'percentage' && value > 100) {
      toast.error('Le pourcentage ne peut pas dépasser 100%')
      return
    }
    
    setDiscount({ type: discountType, value, reason: discountReason || undefined })
    setShowDiscountModal(false)
    setDiscountValue('')
    setDiscountReason('')
    toast.success(`Remise appliquée`)
  }

  const handleRemoveDiscount = () => {
    setDiscount(null)
    toast.success('Remise supprimée')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Panier</h3>
          {items.length > 0 && (
            <button onClick={handleClearCart} className="text-xs text-red-500 hover:underline flex items-center gap-1">
              <Icon name="delete_sweep" className="text-sm" />Vider
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Icon name="shopping_cart_off" className="text-5xl mb-2" />
            <p className="text-sm">Panier vide</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-gray-50 rounded-xl p-3 flex gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-lg relative overflow-hidden flex-shrink-0">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Icon name="inventory_2" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-900 line-clamp-1">{item.name}</h4>
                {item.variant_details && <p className="text-xs text-gray-500">{item.variant_details}</p>}
                <p className="text-sm font-bold text-primary">{formatCurrency(item.price)}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button onClick={() => handleRemoveItem(item.id, item.name)} className="text-gray-400 hover:text-red-500">
                  <Icon name="close" className="text-lg" />
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                    <Icon name="remove" className="text-sm" />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center">
                    <Icon name="add" className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="space-y-1 mb-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Sous-total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount ? (
            <div className="flex justify-between items-center text-green-600">
              <span className="flex items-center gap-1">
                Remise {discount.type === 'percentage' ? `${discount.value}%` : ''}
                <button onClick={handleRemoveDiscount} className="text-red-400 hover:text-red-600">
                  <Icon name="close" className="text-xs" />
                </button>
              </span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          ) : items.length > 0 && (
            <button onClick={() => setShowDiscountModal(true)} className="text-xs text-primary hover:underline">
              + Ajouter remise
            </button>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-bold">Total</span>
            <span className="font-bold text-primary text-xl">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'cash', icon: 'payments', label: 'Espèces' },
            { key: 'card', icon: 'credit_card', label: 'Carte' },
            { key: 'mobile', icon: 'smartphone', label: 'Mobile' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setPaymentMethod(m.key as any)}
              className={`py-2 rounded-lg border text-xs font-medium flex flex-col items-center ${
                paymentMethod === m.key ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200'
              }`}
            >
              <Icon name={m.icon} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Appliquer une remise</h3>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setDiscountType('percentage')} className={`flex-1 py-2 rounded-lg border ${discountType === 'percentage' ? 'border-primary bg-blue-50 text-primary' : ''}`}>%</button>
              <button onClick={() => setDiscountType('fixed')} className={`flex-1 py-2 rounded-lg border ${discountType === 'fixed' ? 'border-primary bg-blue-50 text-primary' : ''}`}>Fixe</button>
            </div>
            <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === 'percentage' ? '10' : '5000'} className="w-full px-3 py-2 border rounded-lg mb-3" />
            <input type="text" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Raison (optionnel)" className="w-full px-3 py-2 border rounded-lg mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowDiscountModal(false)} className="flex-1 py-2 border rounded-lg">Annuler</button>
              <button onClick={handleApplyDiscount} className="flex-1 py-2 bg-primary text-white rounded-lg">Appliquer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
