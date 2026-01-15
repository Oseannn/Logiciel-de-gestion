'use client'

import { useState } from 'react'
import { Client } from '@/lib/types/client.types'
import { useCartStore } from '@/store/cartStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'

interface ClientSelectorProps {
  clients: Client[]
  onCreateClient: (data: { first_name: string; last_name: string; phone: string }) => Promise<void>
}

export function ClientSelector({ clients, onCreateClient }: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [newClient, setNewClient] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  })
  const { client, setClient } = useCartStore()

  const filteredClients = clients.filter(
    (c) =>
      c.first_name.toLowerCase().includes(search.toLowerCase()) ||
      c.last_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  )

  const handleSelectClient = (selectedClient: Client) => {
    setClient(selectedClient)
    setIsOpen(false)
  }

  const handleSelectGuest = () => {
    setClient(null)
    setIsOpen(false)
  }

  const handleCreateClient = async () => {
    if (!newClient.first_name || !newClient.last_name) {
      alert('Veuillez remplir les champs obligatoires')
      return
    }
    await onCreateClient(newClient)
    setNewClient({ first_name: '', last_name: '', phone: '' })
    setIsCreating(false)
  }

  return (
    <>
      {/* Client Selector Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <Icon name="person" />
          </div>
          <div className="flex-1">
            <button
              onClick={() => setIsOpen(true)}
              className="text-sm font-medium text-primary hover:underline flex items-center"
            >
              {client ? `${client.first_name} ${client.last_name}` : 'Sélectionner Client'}
              <Icon name="arrow_drop_down" className="text-sm ml-1" />
            </button>
            <p className="text-xs text-gray-400">
              {client ? 'Client enregistré' : 'Client invité'}
            </p>
          </div>
          <button
            onClick={handleSelectGuest}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs font-medium text-gray-700"
          >
            Non enregistré
          </button>
        </div>
      </div>

      {/* Client Selection Modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Sélectionner un Client">
        <div className="p-6">
          {!isCreating ? (
            <>
              <Input
                placeholder="Rechercher par nom ou téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-4"
              />

              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {filteredClients.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    Aucun client trouvé
                  </div>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectClient(c)}
                      className="w-full p-3 bg-gray-50 hover:bg-blue-50 hover:border-primary rounded-xl text-left transition-colors border border-gray-100 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                        {c.first_name.charAt(0)}{c.last_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {c.first_name} {c.last_name}
                        </p>
                        {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setIsOpen(false)} className="flex-1">
                  Fermer
                </Button>
                <Button onClick={() => setIsCreating(true)} className="flex-1 flex items-center justify-center gap-2">
                  <Icon name="person_add" />
                  Nouveau Client
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Prénom *"
                    value={newClient.first_name}
                    onChange={(e) =>
                      setNewClient({ ...newClient, first_name: e.target.value })
                    }
                    required
                  />
                  <Input
                    label="Nom *"
                    value={newClient.last_name}
                    onChange={(e) =>
                      setNewClient({ ...newClient, last_name: e.target.value })
                    }
                    required
                  />
                </div>
                <Input
                  label="Numéro WhatsApp"
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="+241 ..."
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setIsCreating(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button onClick={handleCreateClient} className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
