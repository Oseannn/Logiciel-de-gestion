'use client'

import { useEffect, useState } from 'react'
import { syncService, SyncStatus as SyncStatusType } from '@/lib/offline'
import { Icon } from '@/components/ui/Icon'

export function SyncStatusBar() {
  const [status, setStatus] = useState<SyncStatusType>({
    isOnline: true,
    pendingSales: 0,
    lastSync: null
  })
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!syncService) return

    // Charger le statut initial
    syncService.getStatus().then(setStatus)

    // Écouter les changements
    const unsubscribe = syncService.onStatusChange(setStatus)

    // Écouter les événements réseau
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

  const handleSync = async () => {
    if (!syncService || syncing || !status.isOnline) return
    setSyncing(true)
    await syncService.fullSync()
    const newStatus = await syncService.getStatus()
    setStatus(newStatus)
    setSyncing(false)
  }

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Jamais'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`
    return date.toLocaleDateString('fr-FR')
  }

  // Mode hors ligne
  if (!status.isOnline) {
    return (
      <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon name="cloud_off" className="text-lg" />
          <span className="font-medium">Mode hors ligne</span>
          {status.pendingSales > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {status.pendingSales} vente{status.pendingSales > 1 ? 's' : ''} en attente
            </span>
          )}
        </div>
        <span className="text-orange-100 text-xs">
          Les ventes seront synchronisées au retour de la connexion
        </span>
      </div>
    )
  }

  // Ventes en attente de sync
  if (status.pendingSales > 0) {
    return (
      <div className="bg-blue-500 text-white px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon name="sync" className={`text-lg ${syncing ? 'animate-spin' : ''}`} />
          <span className="font-medium">
            {syncing ? 'Synchronisation...' : `${status.pendingSales} vente${status.pendingSales > 1 ? 's' : ''} à synchroniser`}
          </span>
        </div>
        {!syncing && (
          <button
            onClick={handleSync}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-medium transition-colors"
          >
            Synchroniser maintenant
          </button>
        )}
      </div>
    )
  }

  // Tout est synchronisé - barre discrète
  return null
}

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatusType>({
    isOnline: true,
    pendingSales: 0,
    lastSync: null
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

  if (!status.isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded-full text-xs font-medium">
        <Icon name="cloud_off" className="text-sm" />
        Hors ligne
        {status.pendingSales > 0 && (
          <span className="bg-orange-200 px-1.5 rounded-full">{status.pendingSales}</span>
        )}
      </div>
    )
  }

  if (status.pendingSales > 0) {
    return (
      <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium">
        <Icon name="sync" className="text-sm" />
        {status.pendingSales} en attente
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
      <Icon name="cloud_done" className="text-sm" />
      Synchronisé
    </div>
  )
}
