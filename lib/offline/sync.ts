/**
 * Service de synchronisation hors ligne
 */

import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { offlineDB, OfflineProduct, OfflineSale, OfflineClient } from './db'

class SyncService {
  private isSyncing = false
  private listeners: Set<(status: SyncStatus) => void> = new Set()

  // ============ STATUS ============

  async getStatus(): Promise<SyncStatus> {
    if (!offlineDB) return { isOnline: true, pendingSales: 0, lastSync: null }

    const pendingSales = await offlineDB.getPendingSales()
    const lastSync = await offlineDB.getMetadata('lastSync')

    return {
      isOnline: navigator.onLine,
      pendingSales: pendingSales.length,
      lastSync: lastSync || null
    }
  }

  onStatusChange(callback: (status: SyncStatus) => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private async notifyListeners() {
    const status = await this.getStatus()
    this.listeners.forEach(cb => cb(status))
  }

  // ============ SYNC PRODUCTS ============

  async syncProducts(): Promise<boolean> {
    if (!offlineDB || !navigator.onLine) return false

    try {
      const supabase = createClient()
      
      // Récupérer tous les produits actifs avec leurs variantes
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, name, sku, brand, category, price, image_url, active,
          product_variants (id, product_id, size, color, stock)
        `)
        .eq('active', true) as { data: { id: string; name: string; sku: string | null; brand: string | null; category: string; price: number; image_url: string | null; active: boolean; product_variants: any[] }[] | null; error: any }

      if (error) throw error

      const offlineProducts: OfflineProduct[] = (products || []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        category: p.category,
        price: p.price,
        image_url: p.image_url,
        active: p.active,
        variants: (p.product_variants || []) as any[],
        synced_at: new Date().toISOString()
      }))

      await offlineDB.saveProducts(offlineProducts)
      await offlineDB.setMetadata('lastProductSync', new Date().toISOString())
      
      console.log(`[Sync] ${offlineProducts.length} produits synchronisés`)
      return true
    } catch (error) {
      console.error('[Sync] Erreur sync produits:', error)
      return false
    }
  }

  // ============ SYNC CLIENTS ============

  async syncClients(): Promise<boolean> {
    if (!offlineDB || !navigator.onLine) return false

    try {
      const supabase = createClient()
      
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, email, type')
        .order('first_name') as { data: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; type: string | null }[] | null; error: any }

      if (error) throw error

      const offlineClients: OfflineClient[] = (clients || []).map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        email: c.email,
        type: (c.type || 'Regular') as 'Regular' | 'VIP',
        synced_at: new Date().toISOString()
      }))

      await offlineDB.saveClients(offlineClients)
      await offlineDB.setMetadata('lastClientSync', new Date().toISOString())
      
      console.log(`[Sync] ${offlineClients.length} clients synchronisés`)
      return true
    } catch (error) {
      console.error('[Sync] Erreur sync clients:', error)
      return false
    }
  }

  // ============ SYNC PENDING SALES ============

  async syncPendingSales(): Promise<SyncResult> {
    if (!offlineDB || !navigator.onLine || this.isSyncing) {
      return { success: 0, failed: 0, total: 0 }
    }

    this.isSyncing = true
    const result: SyncResult = { success: 0, failed: 0, total: 0 }

    try {
      const pendingSales = await offlineDB.getPendingSales()
      result.total = pendingSales.length

      if (pendingSales.length === 0) {
        this.isSyncing = false
        return result
      }

      console.log(`[Sync] ${pendingSales.length} ventes à synchroniser`)

      const supabase = createUntypedClient()

      for (const sale of pendingSales) {
        try {
          // Créer la vente sur le serveur avec les infos de remise
          const saleData: any = {
            vendeuse_id: sale.vendeuse_id,
            client_id: sale.client_id,
            total: sale.total,
            payment_method: sale.payment_method,
            status: 'completed',
            created_at: sale.created_at
          }

          // Ajouter les infos de remise si présentes
          if (sale.discount) {
            saleData.discount_type = sale.discount.type
            saleData.discount_value = sale.discount.value
            saleData.discount_reason = sale.discount.reason || null
            saleData.subtotal = sale.subtotal || sale.total
          }

          const { data: newSale, error: saleError } = await supabase
            .from('sales')
            .insert(saleData)
            .select('id')
            .single()

          if (saleError) throw saleError

          // Créer les items de vente
          const saleItems = sale.items.map(item => ({
            sale_id: newSale.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            price: item.price,
            total: item.total
          }))

          const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItems)

          if (itemsError) throw itemsError

          // Mettre à jour le stock sur le serveur
          for (const item of sale.items) {
            try {
              await supabase.rpc('decrement_stock', {
                p_variant_id: item.variant_id,
                p_quantity: item.quantity
              })
            } catch {
              // Si la fonction RPC n'existe pas, faire manuellement
              const { data } = await supabase
                .from('product_variants')
                .select('stock')
                .eq('id', item.variant_id)
                .single()
              
              if (data) {
                await supabase
                  .from('product_variants')
                  .update({ stock: Math.max(0, data.stock - item.quantity) })
                  .eq('id', item.variant_id)
              }
            }
          }

          // Mettre à jour le total client si applicable
          if (sale.client_id) {
            const { data: client } = await supabase
              .from('clients')
              .select('total_spent')
              .eq('id', sale.client_id)
              .single()

            if (client) {
              await supabase
                .from('clients')
                .update({ total_spent: (client.total_spent || 0) + sale.total })
                .eq('id', sale.client_id)
            }
          }

          // Marquer comme synchronisé
          await offlineDB.markSaleAsSynced(sale.local_id, newSale.id)
          result.success++
          console.log(`[Sync] Vente ${sale.local_id} synchronisée -> ${newSale.id}`)

        } catch (error: any) {
          console.error(`[Sync] Erreur vente ${sale.local_id}:`, error)
          await offlineDB.markSaleError(sale.local_id, error.message || 'Erreur inconnue')
          result.failed++
        }
      }

      // Nettoyer les ventes synchronisées après un délai
      setTimeout(async () => {
        await offlineDB.deleteSyncedSales()
      }, 5000)

      await offlineDB.setMetadata('lastSync', new Date().toISOString())
      await this.notifyListeners()

    } catch (error) {
      console.error('[Sync] Erreur générale:', error)
    }

    this.isSyncing = false
    return result
  }

  // ============ FULL SYNC ============

  async fullSync(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[Sync] Hors ligne, sync impossible')
      return
    }

    console.log('[Sync] Démarrage sync complète...')
    
    await Promise.all([
      this.syncProducts(),
      this.syncClients()
    ])

    await this.syncPendingSales()
    await offlineDB?.setMetadata('lastSync', new Date().toISOString())
    await this.notifyListeners()
    
    console.log('[Sync] Sync complète terminée')
  }

  // ============ AUTO SYNC ============

  startAutoSync(intervalMs: number = 30000) {
    // Sync au démarrage si en ligne
    if (navigator.onLine) {
      this.fullSync()
    }

    // Sync périodique
    setInterval(() => {
      if (navigator.onLine) {
        this.syncPendingSales()
      }
    }, intervalMs)

    // Sync quand on revient en ligne
    window.addEventListener('online', () => {
      console.log('[Sync] Connexion rétablie, synchronisation...')
      this.fullSync()
    })

    window.addEventListener('offline', () => {
      console.log('[Sync] Connexion perdue, mode hors ligne activé')
      this.notifyListeners()
    })
  }
}

export interface SyncStatus {
  isOnline: boolean
  pendingSales: number
  lastSync: string | null
}

export interface SyncResult {
  success: number
  failed: number
  total: number
}

// Singleton
export const syncService = typeof window !== 'undefined' ? new SyncService() : null
