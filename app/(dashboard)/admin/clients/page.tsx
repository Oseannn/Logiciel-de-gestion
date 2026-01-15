'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { exportToCSV, formatClientsForExport } from '@/lib/utils/export'
import { useDataCache, updateCache } from '@/lib/hooks/useDataCache'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Client } from '@/lib/types/client.types'
import toast from 'react-hot-toast'

interface ClientWithHistory extends Client {
  purchases?: {
    id: string
    total: number
    created_at: string
    sale_items: {
      quantity: number
      product: { name: string } | null
    }[]
  }[]
}

export default function ClientsPage() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientWithHistory | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    type: 'Regular' as 'Regular' | 'VIP',
  })

  const supabase = createClient()

  // Utiliser le cache pour les clients
  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('total_spent', { ascending: false })

    if (error) throw error
    return data as Client[]
  }, [supabase])

  const { data: clients, loading, refresh: loadClients, mutate } = useDataCache<Client[]>(
    'clients',
    fetchClients,
    { ttl: 60000 }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Créer un client temporaire pour mise à jour optimiste
    const tempClient: Client = {
      id: `temp-${Date.now()}`,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone,
      email: null,
      type: formData.type,
      total_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user.id
    }

    // Mise à jour optimiste immédiate
    mutate(prev => [tempClient, ...(prev || [])])
    
    setShowModal(false)
    setFormData({ first_name: '', last_name: '', phone: '', type: 'Regular' })
    toast.success('Client créé avec succès !')

    try {
      const supabaseUntyped = createUntypedClient()
      const { data: newClient, error } = await supabaseUntyped
        .from('clients')
        .insert({
          ...formData,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Remplacer le client temporaire par le vrai
      mutate(prev => (prev || []).map(c => 
        c.id === tempClient.id ? (newClient as Client) : c
      ))
    } catch (error) {
      // Annuler la mise à jour optimiste
      mutate(prev => (prev || []).filter(c => c.id !== tempClient.id))
      console.error('Error creating client:', error)
      toast.error('Erreur lors de la création du client')
    }
  }

  const viewClientDetails = async (client: Client) => {
    const { data: purchases } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        created_at,
        sale_items(
          quantity,
          product:products(name)
        )
      `)
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(10)

    setSelectedClient({
      ...client,
      purchases: purchases || []
    })
    setShowDetailsModal(true)
  }

  const clientsList = clients || []
  
  const filteredClients = clientsList.filter(client => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      client.first_name.toLowerCase().includes(search) ||
      client.last_name.toLowerCase().includes(search) ||
      client.phone?.toLowerCase().includes(search)
    )
  })

  const totalClients = clientsList.length
  const totalSpent = clientsList.reduce((sum, c) => sum + (c.total_spent || 0), 0)
  const vipClients = clientsList.filter(c => c.type === 'VIP').length

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-gray-600 mt-1">Gestion de la base clients</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <SkeletonTable rows={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Clients</h1>
        <p className="text-gray-600 mt-1">Gestion de la base clients</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Icon name="groups" className="text-xl" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase">Total Clients</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalClients}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Icon name="payments" className="text-xl" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase">Total Dépensé</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
              <Icon name="star" className="text-xl" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase">Clients VIP</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{vipClients}</p>
        </div>
      </div>

      {/* Search & Add */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Icon name="search" className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadClients()}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Actualiser"
          >
            <Icon name="refresh" className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => exportToCSV(formatClientsForExport(clientsList), 'clients')}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            <Icon name="download" className="mr-2" />
            Exporter
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Icon name="person_add" className="mr-2" />
            Nouveau Client
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Icon name="group" className="text-5xl mb-2" />
            <p>Aucun client trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-4 text-left">Client</th>
                  <th className="px-6 py-4 text-left">Téléphone</th>
                  <th className="px-6 py-4 text-right">Total Dépensé</th>
                  <th className="px-6 py-4 text-center">Type</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client, index) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {client.first_name.charAt(0)}{client.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {client.first_name} {client.last_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {client.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {formatCurrency(client.total_spent || 0)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        client.type === 'VIP' 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {client.type || 'Regular'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => viewClientDetails(client)}
                        className="p-2 text-gray-400 hover:text-primary transition-colors"
                      >
                        <Icon name="visibility" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Client Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nouveau Client">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prénom"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <Input
              label="Nom"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>
          <Input
            label="Numéro WhatsApp"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+241 ..."
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de client</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Regular' | 'VIP' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="Regular">Regular</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Client Details Modal */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="">
        {selectedClient && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-xl text-gray-900">
                  {selectedClient.first_name} {selectedClient.last_name}
                </h3>
                <p className="text-sm text-gray-500">{selectedClient.phone || 'Pas de téléphone'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedClient.type === 'VIP' 
                  ? 'bg-yellow-100 text-yellow-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedClient.type || 'Regular'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-600 uppercase font-bold mb-1">Total Dépensé</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(selectedClient.total_spent || 0)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-600 uppercase font-bold mb-1">Nombre d'Achats</p>
                <p className="text-2xl font-bold text-purple-900">
                  {selectedClient.purchases?.length || 0}
                </p>
              </div>
            </div>

            <h4 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">
              Historique d'Achats
            </h4>
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50">
              <div className="divide-y divide-gray-100">
                {selectedClient.purchases && selectedClient.purchases.length > 0 ? (
                  selectedClient.purchases.map((purchase) => (
                    <div key={purchase.id} className="p-3 hover:bg-white transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {purchase.sale_items.map(item => 
                              `${item.quantity}x ${item.product?.name}`
                            ).join(', ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(purchase.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(purchase.total)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    Aucun achat enregistré
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
