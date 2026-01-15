'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { exportToCSV, formatProductsForExport } from '@/lib/utils/export'
import { useDataCache, updateCache } from '@/lib/hooks/useDataCache'
import toast from 'react-hot-toast'

interface ProductVariant {
  id: string
  size: string
  color: string
  stock: number
}

interface Product {
  id: string
  name: string
  sku: string | null
  brand: string | null
  category: string
  price: number
  image_url: string | null
  active: boolean
  product_variants: ProductVariant[]
}

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    brand: '',
    price: '',
    image_url: '',
    active: true,
    stock: 0,
    hasVariants: false,
    variants: [] as { size: string; color: string; stock: number }[]
  })

  const supabase = createClient()
  const supabaseUntyped = createUntypedClient()

  // Utiliser le cache pour les produits
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        brand,
        category,
        price,
        image_url,
        active,
        product_variants(id, size, color, stock)
      `)
      .order('name')

    if (error) {
      console.error('Error loading products:', error)
      throw error
    }
    return data as Product[]
  }, [supabase])

  const { data: products, loading, refresh: loadProducts, mutate } = useDataCache<Product[]>(
    'products',
    fetchProducts,
    { ttl: 60000 }
  )

  const filteredProducts = (products || []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  )

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      
      // Debug: afficher les variantes du produit
      console.log('=== Opening product for edit ===')
      console.log('Product:', product.name)
      console.log('Variants:', product.product_variants)
      
      // Un produit a des variantes si au moins une variante a une taille ou couleur définie
      const hasRealVariants = product.product_variants.some(v => v.size || v.color)
      
      // Calculer le stock pour un produit simple
      let simpleStock = 0
      if (!hasRealVariants && product.product_variants.length > 0) {
        simpleStock = product.product_variants[0].stock
      }
      
      console.log('hasRealVariants:', hasRealVariants)
      console.log('simpleStock:', simpleStock)
      
      setFormData({
        name: product.name,
        sku: product.sku || '',
        category: product.category,
        brand: product.brand || '',
        price: String(product.price),
        image_url: product.image_url || '',
        active: product.active,
        stock: simpleStock,
        hasVariants: hasRealVariants,
        variants: hasRealVariants ? product.product_variants.map(v => ({
          size: v.size,
          color: v.color,
          stock: v.stock
        })) : []
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        sku: '',
        category: '',
        brand: '',
        price: '',
        image_url: '',
        active: true,
        stock: 0,
        hasVariants: false,
        variants: []
      })
    }
    setModalOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5MB')
      return
    }

    setUploading(true)

    try {
      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `products/${fileName}`

      // Upload vers Supabase Storage
      const { data, error } = await supabaseUntyped.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        // Si le bucket n'existe pas, utiliser une URL data
        console.error('Storage error:', error)
        
        // Fallback: convertir en base64 data URL
        const reader = new FileReader()
        reader.onloadend = () => {
          setFormData({ ...formData, image_url: reader.result as string })
          toast.success('Image chargée (mode local)')
        }
        reader.readAsDataURL(file)
        return
      }

      // Obtenir l'URL publique
      const { data: urlData } = supabaseUntyped.storage
        .from('images')
        .getPublicUrl(filePath)

      setFormData({ ...formData, image_url: urlData.publicUrl })
      toast.success('Image téléchargée !')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Erreur lors du téléchargement')
    } finally {
      setUploading(false)
    }
  }

  const addVariant = () => {
    setFormData({
      ...formData,
      variants: [...formData.variants, { size: '', color: '', stock: 0 }]
    })
  }

  const removeVariant = (index: number) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index)
    })
  }

  const updateVariant = (index: number, field: string, value: string | number) => {
    const newVariants = [...formData.variants]
    newVariants[index] = { ...newVariants[index], [field]: value }
    setFormData({ ...formData, variants: newVariants })
  }

  const handleSave = async () => {
    if (!formData.name || !formData.category || !formData.price) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    setSaving(true)
    console.log('Saving product with formData:', formData)

    try {
      const productData = {
        name: formData.name,
        sku: formData.sku || null,
        category: formData.category,
        brand: formData.brand || null,
        price: parseFloat(formData.price),
        image_url: formData.image_url || null,
        active: formData.active
      }

      if (editingProduct) {
        // Update product
        const { error } = await supabaseUntyped
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)

        if (error) throw error

        // Delete old variants
        const { error: deleteError } = await supabaseUntyped
          .from('product_variants')
          .delete()
          .eq('product_id', editingProduct.id)

        if (deleteError) {
          console.error('Error deleting variants:', deleteError)
        }

        // Insert new variants or simple stock
        if (formData.hasVariants && formData.variants.length > 0) {
          const validVariants = formData.variants.filter(v => v.size || v.color)
          if (validVariants.length > 0) {
            const { error: variantError } = await supabaseUntyped
              .from('product_variants')
              .insert(validVariants.map(v => ({
                product_id: editingProduct.id,
                size: v.size || '',
                color: v.color || '',
                stock: v.stock || 0
              })))
            
            if (variantError) {
              console.error('Error inserting variants:', variantError)
            }
          }
        } else {
          // Produit simple: créer une variante par défaut pour le stock
          console.log('Creating simple variant with stock:', formData.stock)
          const { error: variantError } = await supabaseUntyped
            .from('product_variants')
            .insert({
              product_id: editingProduct.id,
              size: '',
              color: '',
              stock: formData.stock
            })
          
          if (variantError) {
            console.error('Error inserting simple variant:', variantError)
          }
        }

        toast.success('Produit mis à jour')
      } else {
        // Create product
        const { data: newProduct, error } = await supabaseUntyped
          .from('products')
          .insert(productData)
          .select()
          .single()

        if (error) throw error

        console.log('Created product:', newProduct)

        // Insert variants or simple stock
        if (formData.hasVariants && formData.variants.length > 0) {
          const validVariants = formData.variants.filter(v => v.size || v.color)
          if (validVariants.length > 0) {
            const { error: variantError } = await supabaseUntyped
              .from('product_variants')
              .insert(validVariants.map(v => ({
                product_id: newProduct.id,
                size: v.size || '',
                color: v.color || '',
                stock: v.stock || 0
              })))
            
            if (variantError) {
              console.error('Error inserting variants:', variantError)
            }
          }
        } else {
          // Produit simple: créer une variante par défaut pour le stock
          console.log('Creating simple variant for new product with stock:', formData.stock)
          const { error: variantError } = await supabaseUntyped
            .from('product_variants')
            .insert({
              product_id: newProduct.id,
              size: '',
              color: '',
              stock: formData.stock
            })
          
          if (variantError) {
            console.error('Error inserting simple variant:', variantError)
          }
        }

        toast.success('Produit créé')
      }

      setModalOpen(false)
      
      // Recharger pour avoir les données complètes avec variantes
      loadProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    // Mise à jour optimiste immédiate
    mutate(prev => (prev || []).map(p => 
      p.id === product.id ? { ...p, active: !p.active } : p
    ))
    
    toast.success(`Produit ${!product.active ? 'activé' : 'désactivé'}`)

    try {
      const { error } = await supabaseUntyped
        .from('products')
        .update({ active: !product.active })
        .eq('id', product.id)

      if (error) throw error
    } catch (error) {
      // Annuler la mise à jour optimiste en cas d'erreur
      mutate(prev => (prev || []).map(p => 
        p.id === product.id ? { ...p, active: product.active } : p
      ))
      console.error('Error toggling product:', error)
      toast.error('Erreur')
    }
  }

  const deleteProduct = async (product: Product) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return

    // Mise à jour optimiste immédiate
    mutate(prev => (prev || []).filter(p => p.id !== product.id))
    toast.success('Produit supprimé')

    try {
      const { error } = await supabaseUntyped
        .from('products')
        .delete()
        .eq('id', product.id)

      if (error) throw error
    } catch (error) {
      // Annuler en cas d'erreur - recharger les données
      loadProducts()
      console.error('Error deleting product:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const categories = Array.from(new Set((products || []).map(p => p.category).filter(Boolean)))

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Produits</h1>
          <p className="text-gray-600 mt-1">Gérez votre catalogue produits</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadProducts()}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Actualiser"
          >
            <Icon name="refresh" className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              const productsData = (products || []).map(p => ({
                ...p,
                variants: p.product_variants
              }))
              exportToCSV(formatProductsForExport(productsData), 'produits')
            }}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <Icon name="download" className="mr-2" />
            Exporter
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            <Icon name="add" className="mr-2" />
            Nouveau Produit
          </button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Produits ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonTable rows={6} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun produit trouvé</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3">Image</th>
                    <th className="px-6 py-3">Nom / SKU</th>
                    <th className="px-6 py-3">Catégorie</th>
                    <th className="px-6 py-3">Prix</th>
                    <th className="px-6 py-3 text-center">Stock</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((product) => {
                    const totalStock = product.product_variants.reduce((sum, v) => sum + v.stock, 0)
                    const lowStock = totalStock < 5
                    // Vérifier si c'est un produit avec de vraies variantes (taille/couleur)
                    const hasRealVariants = product.product_variants.some(v => v.size || v.color)

                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                              <Icon name="image" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-400">{product.sku || product.id.slice(-8)}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{product.category}</td>
                        <td className="px-6 py-4 font-semibold">{formatCurrency(product.price)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={lowStock ? 'text-red-600 font-bold' : 'text-gray-600'}>
                            {totalStock}
                          </span>
                          {hasRealVariants && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({product.product_variants.length} var.)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={product.active ? 'success' : 'default'}>
                            {product.active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openModal(product)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              onClick={() => toggleProductStatus(product)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title={product.active ? 'Désactiver' : 'Activer'}
                            >
                              <Icon name={product.active ? 'visibility_off' : 'visibility'} />
                            </button>
                            <button
                              onClick={() => deleteProduct(product)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Icon name="delete" />
                            </button>
                          </div>
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

      {/* Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Modifier Produit' : 'Nouveau Produit'}
        size="lg"
      >
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nom du produit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="SKU-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Chaussures, Vêtements..."
                list="categories"
              />
              <datalist id="categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marque</label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Nike, Adidas..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix *</label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="15000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
              <div className="flex gap-2">
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="URL ou télécharger"
                  className="flex-1"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  title="Télécharger une image"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="upload" />
                  )}
                </button>
              </div>
              {formData.image_url && (
                <div className="mt-2">
                  <img
                    src={formData.image_url}
                    alt="Aperçu"
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="rounded text-primary"
            />
            <label htmlFor="active" className="text-sm text-gray-700">Produit actif</label>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasVariants}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      hasVariants: e.target.checked,
                      variants: e.target.checked ? [{ size: '', color: '', stock: 0 }] : []
                    })
                  }}
                  className="rounded text-primary"
                />
                <span className="text-sm font-medium text-gray-700">Produit avec variantes (tailles, couleurs)</span>
              </label>
            </div>

            {!formData.hasVariants ? (
              // Stock simple pour produit sans variantes
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock disponible</label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData({ ...formData, stock: val === '' ? 0 : parseInt(val) })
                  }}
                  placeholder="0"
                  min="0"
                />
              </div>
            ) : (
              // Variantes
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Variantes</label>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="text-sm text-primary hover:underline"
                  >
                    + Ajouter variante
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.variants.map((variant, index) => (
                    <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg">
                      <Input
                        placeholder="Taille (S, M, 42...)"
                        value={variant.size}
                        onChange={(e) => updateVariant(index, 'size', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Couleur"
                        value={variant.color}
                        onChange={(e) => updateVariant(index, 'color', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Stock"
                        value={variant.stock}
                        onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Icon name="close" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
