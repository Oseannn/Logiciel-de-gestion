'use client'

import { useState, memo, useCallback } from 'react'
import Image from 'next/image'
import { Product } from '@/lib/types/product.types'
import { formatCurrency } from '@/lib/utils/currency'
import { useCartStore } from '@/store/cartStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import toast from 'react-hot-toast'

interface ProductGridProps {
  products: Product[]
}

// Helper pour vérifier si un produit a de vraies variantes (avec taille ou couleur)
const hasRealVariants = (product: Product) => {
  return product.variants && product.variants.some(v => v.size || v.color)
}

// Helper pour obtenir le stock total d'un produit
const getTotalStock = (product: Product) => {
  if (!product.variants || product.variants.length === 0) return 0
  return product.variants.reduce((sum, v) => sum + v.stock, 0)
}

// Composant ProductCard mémorisé
const ProductCard = memo(function ProductCard({ 
  product, 
  onProductClick 
}: { 
  product: Product
  onProductClick: (product: Product) => void 
}) {
  const totalStock = getTotalStock(product)
  const hasVariants = hasRealVariants(product)
  const isOutOfStock = totalStock <= 0

  return (
    <button
      onClick={() => onProductClick(product)}
      disabled={isOutOfStock}
      className={`bg-white rounded-2xl p-4 hover:shadow-md active:scale-95 transition-all text-left border border-gray-100 group ${
        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="aspect-square bg-gray-100 rounded-xl mb-3 relative overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Icon name="inventory_2" className="text-4xl" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              ÉPUISÉ
            </span>
          </div>
        )}
        {!isOutOfStock && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <Icon name="add" />
            </div>
          </div>
        )}
      </div>
      <h3 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
        {product.name}
      </h3>
      <p className="text-xs text-gray-400 mb-2">{product.category}</p>
      <div className="flex items-center justify-between">
        <p className="font-bold text-primary">{formatCurrency(product.price)}</p>
        <div className="flex items-center gap-1">
          {hasVariants ? (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {product.variants?.length} var.
            </span>
          ) : (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              totalStock < 5 ? 'text-orange-600 bg-orange-50' : 'text-gray-400 bg-gray-100'
            }`}>
              Stock: {totalStock}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

export function ProductGrid({ products }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const addItem = useCartStore((state) => state.addItem)

  const handleProductClick = useCallback((product: Product) => {
    if (hasRealVariants(product)) {
      setSelectedProduct(product)
      setSelectedVariant(null)
    } else {
      const totalStock = getTotalStock(product)
      if (totalStock <= 0) {
        toast.error('Stock épuisé')
        return
      }
      
      const defaultVariant = product.variants?.[0]
      addItem({
        id: defaultVariant ? `${product.id}-${defaultVariant.id}` : product.id,
        product_id: product.id,
        variant_id: defaultVariant?.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      })
      toast.success('Ajouté au panier')
    }
  }, [addItem])

  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return

    if (!selectedVariant) {
      toast.error('Veuillez sélectionner une variante')
      return
    }
    
    const variant = selectedProduct.variants?.find((v) => v.id === selectedVariant)
    if (variant) {
      if (variant.stock <= 0) {
        toast.error('Stock épuisé pour cette variante')
        return
      }
      addItem({
        id: `${selectedProduct.id}-${variant.id}`,
        product_id: selectedProduct.id,
        variant_id: variant.id,
        name: selectedProduct.name,
        price: selectedProduct.price,
        variant_details: `${variant.size}${variant.size && variant.color ? ' / ' : ''}${variant.color}`,
        image_url: selectedProduct.image_url,
      })
      toast.success('Ajouté au panier')
    }

    setSelectedProduct(null)
    setSelectedVariant(null)
  }, [selectedProduct, selectedVariant, addItem])

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onProductClick={handleProductClick} 
          />
        ))}
      </div>

      {/* Variant Selection Modal */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title="Choisir une variante"
      >
        {selectedProduct && (
          <div className="p-6">
            <p className="text-xs text-gray-500 mb-4">Sélectionnez la taille et la couleur</p>
            
            <div className="flex gap-4 mb-6">
              <div className="w-24 h-24 bg-gray-100 rounded-xl relative overflow-hidden flex-shrink-0">
                {selectedProduct.image_url ? (
                  <Image
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Icon name="inventory_2" className="text-3xl" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selectedProduct.name}</h3>
                <p className="text-gray-500 text-sm">{selectedProduct.category}</p>
                <p className="font-bold text-primary text-xl mt-2">
                  {formatCurrency(selectedProduct.price)}
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
              {selectedProduct.variants?.filter(v => v.size || v.color).map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant.id)}
                  disabled={variant.stock <= 0}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedVariant === variant.id
                      ? 'border-primary bg-blue-50'
                      : variant.stock <= 0
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 hover:border-primary hover:bg-blue-50/50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {selectedVariant === variant.id && (
                        <Icon name="check_circle" className="text-primary" />
                      )}
                      <span className="font-medium text-gray-900">
                        {variant.size}{variant.size && variant.color ? ' / ' : ''}{variant.color}
                      </span>
                    </div>
                    <span className={`text-sm ${variant.stock <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      {variant.stock <= 0 ? 'Épuisé' : `Stock: ${variant.stock}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setSelectedProduct(null)}
                className="flex-1"
              >
                Fermer
              </Button>
              <Button 
                onClick={handleAddToCart} 
                className="flex-1 flex items-center justify-center gap-2"
                disabled={!selectedVariant}
              >
                <Icon name="add_shopping_cart" />
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
