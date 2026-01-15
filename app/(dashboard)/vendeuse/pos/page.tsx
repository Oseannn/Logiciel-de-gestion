'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { useOfflineProducts, useOfflineClients, useOfflineSale, useSyncStatus } from '@/lib/offline'
import { ProductGrid } from '@/components/pos/ProductGrid'
import { Cart } from '@/components/pos/Cart'
import { ClientSelector } from '@/components/pos/ClientSelector'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { SyncStatusBar } from '@/components/offline/SyncStatus'
import { useCartStore } from '@/store/cartStore'
import { Icon } from '@/components/ui/Icon'
import { ReceiptSale } from '@/lib/utils/receipt'
import toast from 'react-hot-toast'

export default function POSPage() {
  const [processing, setProcessing] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [lastSale, setLastSale] = useState<ReceiptSale | null>(null)
  const [cashRegisterOpen, setCashRegisterOpen] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Vendeuse')
  
  const router = useRouter()
  const supabase = createClient()
  const supabaseUntyped = createUntypedClient()
  
  // Hooks offline
  const { products, loading: productsLoading, isOffline: productsOffline } = useOfflineProducts()
  const { clients, isOffline: clientsOffline, refresh: refreshClients } = useOfflineClients()
  const { createSale } = useOfflineSale()
  const { isOnline, pendingSales } = useSyncStatus()
  
  const { items, client, paymentMethod, discount, clearCart, getSubtotal, getTotal } = useCartStore()

  useEffect(() => {
    checkAuth()
    checkCashRegister()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
    
    if (profile) {
      setUserName((profile as any).name || 'Vendeuse')
    }
  }

  const checkCashRegister = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data, error } = await supabaseUntyped
        .from('cash_register')
        .select('*')
        .eq('vendeuse_id', user.id)
        .eq('status', 'open')
        .gte('opened_at', today.toISOString())
        .order('opened_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error checking cash register:', error)
        // En mode hors ligne, on permet de vendre quand même
        setCashRegisterOpen(!isOnline ? true : false)
        return
      }

      setCashRegisterOpen(data && data.length > 0)
    } catch (error) {
      console.error('Error checking cash register:', error)
      setCashRegisterOpen(!isOnline ? true : false)
    }
  }

  const handleCreateClient = async (data: {
    first_name: string
    last_name: string
    phone: string
  }) => {
    if (!isOnline) {
      toast.error('Création de client impossible hors ligne')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          created_by: user.id,
        } as any)
        .select()
        .single()

      if (error) throw error
      
      toast.success('Client créé !')
      
      // Rafraîchir la liste des clients immédiatement
      await refreshClients()
    } catch (error: any) {
      console.error('Error creating client:', error)
      toast.error('Erreur lors de la création')
    }
  }

  const handleProcessSale = async () => {
    if (items.length === 0) {
      toast.error('Le panier est vide')
      return
    }

    if (!cashRegisterOpen && isOnline) {
      toast.error('Veuillez ouvrir la caisse avant de vendre')
      return
    }

    if (!userId) {
      toast.error('Non authentifié')
      return
    }

    setProcessing(true)

    try {
      const total = getTotal()
      const subtotal = getSubtotal()

      // Préparer les items pour la vente
      const saleItems = items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id || '',
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }))

      // Créer la vente (online ou offline) avec la remise
      const result = await createSale(
        userId,
        client?.id || null,
        total,
        paymentMethod,
        saleItems,
        discount,
        subtotal
      )

      if (!result.success) {
        throw new Error('Échec de la création de la vente')
      }

      // Si vente en ligne, mettre à jour la caisse
      if (!result.offline && paymentMethod === 'cash') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data: cashRegisterData } = await supabaseUntyped
          .from('cash_register')
          .select('id, sales_total')
          .eq('vendeuse_id', userId)
          .eq('status', 'open')
          .gte('opened_at', today.toISOString())
          .order('opened_at', { ascending: false })
          .limit(1)
          .single()

        if (cashRegisterData) {
          const newSalesTotal = (cashRegisterData.sales_total || 0) + total
          await supabaseUntyped
            .from('cash_register')
            .update({ sales_total: newSalesTotal })
            .eq('id', cashRegisterData.id)
        }
      }

      // Préparer les données du ticket
      const receiptData: ReceiptSale = {
        id: result.saleId,
        created_at: new Date().toISOString(),
        total,
        payment_method: paymentMethod,
        vendeuse_name: userName,
        client_name: client ? `${client.first_name} ${client.last_name}` : undefined,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        }))
      }

      clearCart()
      setLastSale(receiptData)
      setReceiptModalOpen(true)
      
      if (result.offline) {
        toast.success('Vente enregistrée hors ligne !', {
          icon: '📴',
          duration: 4000
        })
      } else {
        toast.success('Vente enregistrée !')
      }

    } catch (error: any) {
      console.error('Error processing sale:', error)
      toast.error(error.message || 'Erreur lors de la vente')
    } finally {
      setProcessing(false)
    }
  }

  // Convertir les produits offline en format attendu par ProductGrid
  const formattedProducts = products.map(p => ({
    ...p,
    variants: p.variants || []
  }))

  // Convertir les clients offline en format attendu
  const formattedClients = clients.map(c => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    phone: c.phone,
    email: c.email,
    type: c.type,
    total_spent: 0,
    created_at: c.synced_at,
    created_by: null
  }))

  const categories = ['all', ...Array.from(new Set(formattedProducts.map((p) => p.category).filter(Boolean)))]

  // Recherche améliorée : nom, SKU, marque
  const filteredProducts = formattedProducts.filter((p) => {
    const searchLower = search.toLowerCase().trim()
    const matchesSearch = !searchLower || 
      p.name.toLowerCase().includes(searchLower) ||
      (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
      (p.brand && p.brand.toLowerCase().includes(searchLower))
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement du catalogue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-100 flex-col overflow-hidden">
      {/* Barre de statut sync */}
      <SyncStatusBar />

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Cash Register Warning - seulement si en ligne */}
        {cashRegisterOpen === false && isOnline && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="point_of_sale" className="text-3xl text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Caisse Fermée</h2>
              <p className="text-gray-600 mb-6">
                Vous devez ouvrir votre caisse avant de pouvoir effectuer des ventes.
              </p>
              <Link
                href="/vendeuse/caisse"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
              >
                <Icon name="lock_open" />
                Ouvrir la Caisse
              </Link>
            </div>
          </div>
        )}

        {/* Left: Catalog (65%) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-gray-200 bg-gray-50">
          {/* Catalog Header */}
          <div className="p-4 bg-white border-b border-gray-200 shadow-sm z-10">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Scanner ou rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow font-medium"
                />
                {(productsOffline || clientsOffline) && (
                  <span className="absolute right-12 top-2.5 text-xs text-orange-500 font-medium">
                    Cache
                  </span>
                )}
                <button className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600">
                  <Icon name="barcode_scanner" />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {cat === 'all' ? 'Tout' : cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Icon name="inventory_2" className="text-6xl mb-4" />
                <p>Aucun produit trouvé</p>
                {!isOnline && (
                  <p className="text-sm mt-2">Mode hors ligne - données en cache</p>
                )}
              </div>
            ) : (
              <ProductGrid products={filteredProducts as any} />
            )}
          </div>
        </div>

        {/* Right: Cart (35%) */}
        <div className="w-full lg:w-[400px] bg-white flex flex-col h-full shadow-xl z-20">
          <ClientSelector 
            clients={formattedClients as any} 
            onCreateClient={handleCreateClient} 
          />
          <Cart />
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleProcessSale}
              disabled={items.length === 0 || processing}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-blue-600 active:scale-95 transition-all text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {!isOnline && <Icon name="cloud_off" className="text-xl" />}
              <Icon name="check_circle" />
              {processing ? 'Traitement...' : 'ENCAISSER'}
            </button>
            {!isOnline && (
              <p className="text-center text-xs text-orange-500 mt-2">
                Mode hors ligne - La vente sera synchronisée plus tard
              </p>
            )}
          </div>
        </div>

        {/* Receipt Modal */}
        {lastSale && (
          <ReceiptModal
            sale={lastSale}
            isOpen={receiptModalOpen}
            onClose={() => {
              setReceiptModalOpen(false)
              setLastSale(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
