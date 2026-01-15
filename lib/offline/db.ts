/**
 * IndexedDB wrapper pour le stockage hors ligne
 */

const DB_NAME = 'retailos-offline'
const DB_VERSION = 1

export interface OfflineProduct {
  id: string
  name: string
  sku: string | null
  brand: string | null
  category: string
  price: number
  image_url: string | null
  active: boolean
  variants: OfflineVariant[]
  synced_at: string
}

export interface OfflineVariant {
  id: string
  product_id: string
  size: string
  color: string
  stock: number
}

export interface OfflineSale {
  id: string
  local_id: string // ID local unique pour éviter les doublons
  vendeuse_id: string
  client_id: string | null
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  items: OfflineSaleItem[]
  created_at: string
  synced: boolean
  sync_error?: string
  discount?: {
    type: 'percentage' | 'fixed'
    value: number
    reason?: string
  }
  subtotal?: number
}

export interface OfflineSaleItem {
  product_id: string
  variant_id: string
  product_name: string
  quantity: number
  price: number
  total: number
}

export interface OfflineClient {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  type: 'Regular' | 'VIP'
  synced_at: string
}

class OfflineDB {
  private db: IDBDatabase | null = null
  private dbReady: Promise<IDBDatabase>

  constructor() {
    this.dbReady = this.initDB()
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB not available on server'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store pour les produits
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' })
          productStore.createIndex('category', 'category', { unique: false })
          productStore.createIndex('active', 'active', { unique: false })
        }

        // Store pour les ventes en attente de sync
        if (!db.objectStoreNames.contains('pending_sales')) {
          const salesStore = db.createObjectStore('pending_sales', { keyPath: 'local_id' })
          salesStore.createIndex('synced', 'synced', { unique: false })
          salesStore.createIndex('created_at', 'created_at', { unique: false })
        }

        // Store pour les clients
        if (!db.objectStoreNames.contains('clients')) {
          const clientStore = db.createObjectStore('clients', { keyPath: 'id' })
          clientStore.createIndex('type', 'type', { unique: false })
        }

        // Store pour les métadonnées (dernière sync, etc.)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      }
    })
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db
    return this.dbReady
  }

  // ============ PRODUCTS ============

  async saveProducts(products: OfflineProduct[]): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')

    // Clear existing products
    store.clear()

    // Add new products
    for (const product of products) {
      store.put({ ...product, synced_at: new Date().toISOString() })
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getProducts(): Promise<OfflineProduct[]> {
    const db = await this.getDB()
    const tx = db.transaction('products', 'readonly')
    const store = tx.objectStore('products')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getProductsByCategory(category: string): Promise<OfflineProduct[]> {
    const db = await this.getDB()
    const tx = db.transaction('products', 'readonly')
    const store = tx.objectStore('products')
    const index = store.index('category')

    return new Promise((resolve, reject) => {
      const request = index.getAll(category)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async updateProductStock(variantId: string, quantitySold: number): Promise<void> {
    const db = await this.getDB()
    const products = await this.getProducts()
    
    for (const product of products) {
      const variant = product.variants.find(v => v.id === variantId)
      if (variant) {
        variant.stock = Math.max(0, variant.stock - quantitySold)
        const tx = db.transaction('products', 'readwrite')
        const store = tx.objectStore('products')
        store.put(product)
        return
      }
    }
  }

  // ============ SALES ============

  async savePendingSale(sale: OfflineSale): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('pending_sales', 'readwrite')
    const store = tx.objectStore('pending_sales')
    store.put(sale)

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getPendingSales(): Promise<OfflineSale[]> {
    const db = await this.getDB()
    const tx = db.transaction('pending_sales', 'readonly')
    const store = tx.objectStore('pending_sales')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        // Filtrer les ventes non synchronisées
        const allSales = request.result || []
        const pendingSales = allSales.filter((sale: OfflineSale) => !sale.synced)
        resolve(pendingSales)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllPendingSales(): Promise<OfflineSale[]> {
    const db = await this.getDB()
    const tx = db.transaction('pending_sales', 'readonly')
    const store = tx.objectStore('pending_sales')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async markSaleAsSynced(localId: string, serverId: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('pending_sales', 'readwrite')
    const store = tx.objectStore('pending_sales')

    return new Promise((resolve, reject) => {
      const request = store.get(localId)
      request.onsuccess = () => {
        const sale = request.result
        if (sale) {
          sale.synced = true
          sale.id = serverId
          store.put(sale)
        }
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async markSaleError(localId: string, error: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('pending_sales', 'readwrite')
    const store = tx.objectStore('pending_sales')

    return new Promise((resolve, reject) => {
      const request = store.get(localId)
      request.onsuccess = () => {
        const sale = request.result
        if (sale) {
          sale.sync_error = error
          store.put(sale)
        }
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteSyncedSales(): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('pending_sales', 'readwrite')
    const store = tx.objectStore('pending_sales')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const allSales = request.result || []
        // Supprimer les ventes synchronisées
        allSales.forEach((sale: OfflineSale) => {
          if (sale.synced) {
            store.delete(sale.local_id)
          }
        })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // ============ CLIENTS ============

  async saveClients(clients: OfflineClient[]): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('clients', 'readwrite')
    const store = tx.objectStore('clients')

    store.clear()
    for (const client of clients) {
      store.put({ ...client, synced_at: new Date().toISOString() })
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getClients(): Promise<OfflineClient[]> {
    const db = await this.getDB()
    const tx = db.transaction('clients', 'readonly')
    const store = tx.objectStore('clients')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // ============ METADATA ============

  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction('metadata', 'readwrite')
    const store = tx.objectStore('metadata')
    store.put({ key, value, updated_at: new Date().toISOString() })

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getMetadata(key: string): Promise<any> {
    const db = await this.getDB()
    const tx = db.transaction('metadata', 'readonly')
    const store = tx.objectStore('metadata')

    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result?.value)
      request.onerror = () => reject(request.error)
    })
  }

  // ============ UTILS ============

  async clearAll(): Promise<void> {
    const db = await this.getDB()
    const stores = ['products', 'pending_sales', 'clients', 'metadata']
    
    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).clear()
    }
  }
}

// Singleton instance
export const offlineDB = typeof window !== 'undefined' ? new OfflineDB() : null
