'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Cache global en mémoire
const globalCache: Map<string, CacheEntry<any>> = new Map()

// Listeners pour les mises à jour en temps réel
const cacheListeners: Map<string, Set<(data: any) => void>> = new Map()

// Durée de validité du cache (10 minutes pour réduire les appels)
const CACHE_TTL = 10 * 60 * 1000

// Charger le cache depuis localStorage au démarrage
if (typeof window !== 'undefined') {
  try {
    const savedCache = localStorage.getItem('retailos_cache')
    if (savedCache) {
      const parsed = JSON.parse(savedCache)
      Object.entries(parsed).forEach(([key, entry]: [string, any]) => {
        // Ne charger que si le cache a moins de 10 minutes
        if (Date.now() - entry.timestamp < CACHE_TTL) {
          globalCache.set(key, entry)
        }
      })
    }
  } catch (e) {
    console.warn('Failed to load cache from localStorage')
  }
}

// Sauvegarder le cache dans localStorage
function saveToLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    const cacheObj: Record<string, CacheEntry<any>> = {}
    globalCache.forEach((value, key) => {
      cacheObj[key] = value
    })
    localStorage.setItem('retailos_cache', JSON.stringify(cacheObj))
  } catch (e) {
    console.warn('Failed to save cache to localStorage')
  }
}

// Notifier tous les listeners d'une clé
function notifyListeners(key: string, data: any) {
  const listeners = cacheListeners.get(key)
  if (listeners) {
    listeners.forEach(listener => listener(data))
  }
}

export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number
    revalidateOnFocus?: boolean
  }
) {
  const [data, setData] = useState<T | null>(() => {
    const cached = globalCache.get(key)
    if (cached && Date.now() - cached.timestamp < (options?.ttl || CACHE_TTL)) {
      return cached.data
    }
    return null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<Error | null>(null)
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async (force = false) => {
    // Éviter les requêtes multiples simultanées
    if (fetchingRef.current && !force) return
    
    // Vérifier le cache si pas forcé
    if (!force) {
      const cached = globalCache.get(key)
      if (cached && Date.now() - cached.timestamp < (options?.ttl || CACHE_TTL)) {
        setData(cached.data)
        setLoading(false)
        return cached.data
      }
    }

    fetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      globalCache.set(key, { data: result, timestamp: Date.now() })
      saveToLocalStorage() // Persister le cache
      setData(result)
      notifyListeners(key, result)
      return result
    } catch (err) {
      setError(err as Error)
      console.error(`Error fetching ${key}:`, err)
      return null
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [key, fetcher, options?.ttl])

  // S'abonner aux mises à jour
  useEffect(() => {
    const listener = (newData: T) => {
      setData(newData)
    }
    
    if (!cacheListeners.has(key)) {
      cacheListeners.set(key, new Set())
    }
    cacheListeners.get(key)!.add(listener)
    
    return () => {
      cacheListeners.get(key)?.delete(listener)
    }
  }, [key])

  // Charger les données au montage
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Revalider quand la fenêtre reprend le focus
  useEffect(() => {
    if (options?.revalidateOnFocus === false) return

    const handleFocus = () => {
      const cached = globalCache.get(key)
      // Revalider seulement si le cache est vieux de plus de 30 secondes
      if (!cached || Date.now() - cached.timestamp > 30000) {
        fetchData()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [key, fetchData, options?.revalidateOnFocus])

  const refresh = useCallback(() => fetchData(true), [fetchData])

  // Mise à jour optimiste - met à jour l'UI immédiatement
  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    const updated = typeof newData === 'function' 
      ? (newData as (prev: T | null) => T)(data)
      : newData
    setData(updated)
    globalCache.set(key, { data: updated, timestamp: Date.now() })
    notifyListeners(key, updated)
  }, [key, data])

  return { data, loading, error, refresh, mutate }
}

// Fonction pour invalider le cache
export function invalidateCache(key?: string) {
  if (key) {
    globalCache.delete(key)
    // Notifier avec null pour forcer un rechargement
    notifyListeners(key, null)
  } else {
    globalCache.clear()
  }
}

// Fonction pour mettre à jour le cache directement (optimistic update)
export function updateCache<T>(key: string, updater: (prev: T | null) => T) {
  const cached = globalCache.get(key)
  const newData = updater(cached?.data || null)
  globalCache.set(key, { data: newData, timestamp: Date.now() })
  notifyListeners(key, newData)
}

// Fonction pour précharger des données
export function prefetchData<T>(key: string, fetcher: () => Promise<T>) {
  fetcher().then(data => {
    globalCache.set(key, { data, timestamp: Date.now() })
    notifyListeners(key, data)
  }).catch(console.error)
}
