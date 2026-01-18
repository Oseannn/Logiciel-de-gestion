'use client'

import { useState, useEffect, useCallback } from 'react'
import { offlineDB, OfflineProduct, OfflineClient, OfflineSale, OfflineSaleItem } from './db'
import { syncService } from './sync'
import { createClient, createUntypedClient } from '@/lib/supabase/client'

/**
 * Hook pour charger les produits (online ou offline)
 */
export function useOfflineProducts() {
  const [products, setProducts] = useState<OfflineProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)

    // Essayer d'abord en ligne via l'API (produits rapides)
    if (navigator.onLine) {
      try {
        const response = await fetch('/api/products?page=1&limit=50')
        if (!response.ok) {
          throw new Error('Failed to load products')
        }

        const result = await response.json()
        const data = Array.isArray(result) ? result : (result.data || [])

        if (data) {
          // Charger les variantes en second temps
          const ids = data.map((p: any) => p.id).join(',')
          let variants: any[] = []
          try {
            const variantsResponse = await fetch(`/api/product-variants?ids=${ids}`)
            if (variantsResponse.ok) {
              const variantsResult = await variantsResponse.json()
              variants = variantsResult.data || []
            }
          } catch (e) {
            // ignore
          }

          const variantMap: Record<string, any[]> = {}
          variants.forEach(v => {
            if (!variantMap[v.product_id]) variantMap[v.product_id] = []
            variantMap[v.product_id].push(v)
          })

          const offlineProducts: OfflineProduct[] = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            brand: p.brand,
            category: p.category,
            price: p.price,
            image_url: p.image_url,
            active: p.active,
            variants: (variantMap[p.id] || []) as any[],
            synced_at: new Date().toISOString()
          }))

          setProducts(offlineProducts)
          setIsOffline(false)

          // Sauvegarder pour usage hors ligne
          if (offlineDB) {
            await offlineDB.saveProducts(offlineProducts)
          }

          setLoading(false)
          return
        }
      } catch (error) {
        console.error('Erreur chargement produits online:', error)
      }
    }

    // Fallback: charger depuis IndexedDB
    if (offlineDB) {
      try {
        const offlineProducts = await offlineDB.getProducts()
        setProducts(offlineProducts)
        setIsOffline(true)
        console.log(`[Offline] ${offlineProducts.length} produits chargés depuis le cache`)
      } catch (error) {
        console.error('Erreur chargement produits offline:', error)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()

    // Recharger quand on revient en ligne
    const handleOnline = () => {
      console.log('[Offline] Connexion rétablie, rechargement des produits...')
      loadProducts()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [loadProducts])

  return { products, loading, isOffline, refresh: loadProducts }
}

/**
 * Hook pour charger les clients (online ou offline)
 */
export function useOfflineClients() {
  const [clients, setClients] = useState<OfflineClient[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)

  const loadClients = useCallback(async () => {
    setLoading(true)

    if (navigator.onLine) {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name, phone, email, type')
          .order('first_name') as { data: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; type: string | null }[] | null; error: any }

        if (!error && data) {
          const offlineClients: OfflineClient[] = data.map(c => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            phone: c.phone,
            email: c.email,
            type: (c.type || 'Regular') as 'Regular' | 'VIP',
            synced_at: new Date().toISOString()
          }))

          setClients(offlineClients)
          setIsOffline(false)

          if (offlineDB) {
            await offlineDB.saveClients(offlineClients)
          }

          setLoading(false)
          return
        }
      } catch (error) {
        console.error('Erreur chargement clients online:', error)
      }
    }

    // Fallback offline
    if (offlineDB) {
      try {
        const offlineClients = await offlineDB.getClients()
        setClients(offlineClients)
        setIsOffline(true)
      } catch (error) {
        console.error('Erreur chargement clients offline:', error)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadClients()

    const handleOnline = () => loadClients()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [loadClients])

  return { clients, loading, isOffline, refresh: loadClients }
}

/**
 * Hook pour créer une vente (online ou offline)
 */
export function useOfflineSale() {
  const [saving, setSaving] = useState(false)

  const createSale = async (
    vendeuseId: string,
    clientId: string | null,
    total: number,
    paymentMethod: 'cash' | 'card' | 'mobile',
    items: OfflineSaleItem[],
    discount?: { type: 'percentage' | 'fixed'; value: number; reason?: string } | null,
    subtotal?: number
  ): Promise<{ success: boolean; offline: boolean; saleId: string }> => {
    setSaving(true)

    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const createdAt = new Date().toISOString()

    // Essayer d'abord en ligne
    if (navigator.onLine) {
      try {
        const supabase = createUntypedClient()

        // Créer la vente avec les infos de remise
        const saleData: any = {
          vendeuse_id: vendeuseId,
          client_id: clientId,
          total,
          payment_method: paymentMethod,
          status: 'completed'
        }

        // Ajouter les infos de remise si présentes
        if (discount) {
          saleData.discount_type = discount.type
          saleData.discount_value = discount.value
          saleData.discount_reason = discount.reason || null
          saleData.subtotal = subtotal || total
        }

        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert(saleData)
          .select('id')
          .single()

        if (saleError || !sale) throw saleError || new Error('Failed to create sale')

        // Créer les items
        const saleItems = items.map(item => ({
          sale_id: sale.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }))

        await supabase.from('sale_items').insert(saleItems)

        // Mettre à jour les stocks
        for (const item of items) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock')
            .eq('id', item.variant_id)
            .single()

          if (variant) {
            await supabase
              .from('product_variants')
              .update({ stock: Math.max(0, variant.stock - item.quantity) })
              .eq('id', item.variant_id)
          }
        }

        // Mettre à jour le total client
        if (clientId) {
          const { data: client } = await supabase
            .from('clients')
            .select('total_spent')
            .eq('id', clientId)
            .single()

          if (client) {
            await supabase
              .from('clients')
              .update({ total_spent: (client.total_spent || 0) + total })
              .eq('id', clientId)
          }
        }

        setSaving(false)
        return { success: true, offline: false, saleId: sale.id }

      } catch (error) {
        console.error('Erreur création vente online:', error)
        // Continuer en mode offline
      }
    }

    // Mode offline: sauvegarder localement
    if (offlineDB) {
      try {
        const offlineSale: OfflineSale = {
          id: '',
          local_id: localId,
          vendeuse_id: vendeuseId,
          client_id: clientId,
          total,
          payment_method: paymentMethod,
          items,
          created_at: createdAt,
          synced: false,
          discount: discount || undefined,
          subtotal: subtotal
        }

        await offlineDB.savePendingSale(offlineSale)

        // Mettre à jour le stock local
        for (const item of items) {
          await offlineDB.updateProductStock(item.variant_id, item.quantity)
        }

        console.log(`[Offline] Vente ${localId} sauvegardée localement`)
        
        setSaving(false)
        return { success: true, offline: true, saleId: localId }

      } catch (error) {
        console.error('Erreur sauvegarde vente offline:', error)
      }
    }

    setSaving(false)
    return { success: false, offline: false, saleId: '' }
  }

  return { createSale, saving }
}

/**
 * Hook pour le statut de synchronisation
 */
export function useSyncStatus() {
  const [status, setStatus] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingSales: 0,
    lastSync: null as string | null
  })

  useEffect(() => {
    if (!syncService) return

    syncService.getStatus().then(setStatus)
    const unsubscribe = syncService.onStatusChange(setStatus)

    const handleOnline = () => setStatus(s => ({ ...s, isOnline: true }))
    const handleOffline = () => setStatus(s => ({ ...s, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const sync = async () => {
    if (syncService && navigator.onLine) {
      await syncService.fullSync()
      const newStatus = await syncService.getStatus()
      setStatus(newStatus)
    }
  }

  return { ...status, sync }
}
