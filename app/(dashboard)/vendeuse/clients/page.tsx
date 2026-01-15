'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDataCache, updateCache } from '@/lib/hooks/useDataCache'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils/currency'
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

  const fetchClients = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('first_name')
    if (error) throw error
    return data as Client[]
  }, [])

  const { data: clients, loading, mutate } = useDataCache<Client[]>(
    'vendeuse-clients',
    fetchClients
  )

  const clientsData = clients || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const supabase = createClient()
    
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
    mutate((prev) => [...(prev || []), tempClient])
    
    setShowModal(false)
    setFormData({ first_name: '', last_name: '', phone: '', type: 'Regular' })

    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...formData,
        created_by: user.id
      } as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating client:', error)
      // Rollback
      mutate((prev) => (prev || []).filter(c => c.id !== tempClient.id))
      toast.error('Erreur lors de la création du client')
      return
    }

    // Remplacer le client temporaire par le vrai
    mutate((prev) => (prev || []).map(c => 
      c.id === tempClient.id ? data : c
    ))
    
    // Mettre à jour aussi le cache global des clients
    updateCache<Client[]>('clients', (prev) => [...(prev || []), data])
    
    toast.success('Client créé avec succès !')
  }

  const viewClientDetails = async (client: Client) => {
    const supabase = createClient()
    
    // Load client's purchase history
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

  const filteredClients = clientsData.filter(client => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      client.first_name.toLowerCase().includes(search) ||
      client.last_name.toLowerCase().includes(search) ||
      client.phone?.toLowerCase().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <SkeletonTable rows={8} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-24 lg:pb-8 overflow-y-auto h-full">
      {/* Header */}
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
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-primary/30"
        >
          <Icon name="person_add" className="mr-2" />
          Nouveau Client
        </button>
      </div>

      {/* Clients List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Icon name="group" className="text-5xl mb-2" />
              <p>Aucun client enregistré</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${
                    client.type === 'VIP' 
                      ? 'bg-yellow-100 text-yellow-600' 
                      : 'bg-gray-100 text-gray-500'
                  } flex items-center justify-center font-bold`}>
                    {client.first_name.charAt(0)}{client.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">
                      {client.first_name} {client.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {client.phone || 'Pas de téléphone'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(client.total_spent || 0)}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      client.type === 'VIP' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {client.type || 'Regular'}
                    </span>
                  </div>
                  <button
                    onClick={() => viewClientDetails(client)}
                    className="p-2 text-gray-400 hover:text-primary transition-colors"
                  >
                    <Icon name="visibility" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* New Client Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nouveau Client"
      >
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Client Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title=""
      >
        {selectedClient && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-xl text-gray-900">
                  {selectedClient.first_name} {selectedClient.last_name}
                </h3>
                <p className="text-sm text-gray-500">{selectedClient.phone || 'Pas de téléphone'}</p>
              </div>
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
