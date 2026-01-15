'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { useDataCache, updateCache } from '@/lib/hooks/useDataCache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils/date'

interface Profile {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'vendeuse'
  status: 'active' | 'inactive'
  avatar_url: string | null
  is_online: boolean
  last_seen: string | null
  created_at: string
  updated_at: string
}

interface UserSession {
  id: string
  user_id: string
  action: 'login' | 'logout'
  created_at: string
  profiles?: { name: string; email: string }
}

export default function UsersPage() {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'vendeuse' as 'admin' | 'manager' | 'vendeuse',
    status: 'active' as 'active' | 'inactive',
    password: ''
  })

  // Utiliser useDataCache pour les utilisateurs
  const fetchUsers = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as Profile[]) || []
  }, [])

  const { data: users, loading, refresh: refreshUsers, mutate } = useDataCache<Profile[]>(
    'admin-users',
    fetchUsers
  )

  useEffect(() => {
    loadRecentSessions()
  }, [])

  const loadRecentSessions = async () => {
    const supabase = createUntypedClient()

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setSessions(data)
    }
  }

  const loadUserSessions = async (userId: string) => {
    const supabase = createUntypedClient()

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setSessions(data)
    }
    setSelectedUserId(userId)
    setShowHistoryModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const supabaseUntyped = createUntypedClient()

    if (editingUser) {
      const updateData = {
        name: formData.name,
        role: formData.role,
        status: formData.status,
        updated_at: new Date().toISOString()
      }
      
      const { error } = await supabaseUntyped
        .from('profiles')
        .update(updateData)
        .eq('id', editingUser.id)

      setSaving(false)

      if (error) {
        console.error('Error updating user:', error)
        alert('Erreur lors de la mise à jour de l\'utilisateur')
        return
      }

      // Mise à jour optimiste
      mutate((prev) => (prev || []).map(u => 
        u.id === editingUser.id 
          ? { ...u, name: formData.name, role: formData.role, status: formData.status }
          : u
      ))
    } else {
      if (!formData.password || formData.password.length < 6) {
        setSaving(false)
        alert('Le mot de passe doit contenir au moins 6 caractères')
        return
      }

      try {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role,
            status: formData.status
          })
        })

        const result = await response.json()
        setSaving(false)

        if (!response.ok) {
          if (result.needsConfig) {
            await createUserFallback()
            return
          }
          alert('Erreur: ' + result.error)
          return
        }

        alert('Utilisateur créé avec succès!')
      } catch (error) {
        console.error('Error creating user:', error)
        setSaving(false)
        await createUserFallback()
        return
      }
    }

    setShowModal(false)
    setEditingUser(null)
    setFormData({ email: '', name: '', role: 'vendeuse', status: 'active', password: '' })
    refreshUsers()
  }

  const createUserFallback = async () => {
    const supabase = createClient()
    const supabaseUntyped = createUntypedClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: { data: { name: formData.name, role: formData.role } }
    })

    if (authError) {
      alert('Erreur lors de la création: ' + authError.message)
      return
    }

    if (authData.user) {
      await supabaseUntyped
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          role: formData.role,
          status: formData.status,
          is_online: false
        }, { onConflict: 'id' })
    }

    setShowModal(false)
    setEditingUser(null)
    setFormData({ email: '', name: '', role: 'vendeuse', status: 'active', password: '' })
    refreshUsers()
  }

  const handleEdit = (user: Profile) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      password: ''
    })
    setShowModal(true)
  }

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    
    // Mise à jour optimiste immédiate
    mutate((prev) => (prev || []).map(u => 
      u.id === userId ? { ...u, status: newStatus as 'active' | 'inactive' } : u
    ))
    
    const supabaseUntyped = createUntypedClient()
    const { error } = await supabaseUntyped
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      // Rollback en cas d'erreur
      mutate((prev) => (prev || []).map(u => 
        u.id === userId ? { ...u, status: currentStatus as 'active' | 'inactive' } : u
      ))
      alert('Erreur lors de la mise à jour du statut')
    }
  }

  const handleResetPassword = async (userId: string, userName: string) => {
    const newPassword = prompt(`Nouveau mot de passe pour "${userName}" (min 6 caractères):`)
    if (!newPassword) return
    if (newPassword.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: newPassword })
      })

      const result = await response.json()
      if (!response.ok) {
        alert('Erreur: ' + result.error)
        return
      }
      alert(`Mot de passe réinitialisé pour ${userName}!`)
    } catch (error) {
      alert('Erreur lors de la réinitialisation')
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer "${userName}" ?`)) return

    // Sauvegarde pour rollback
    const previousUsers = users || []
    
    // Mise à jour optimiste immédiate
    mutate((prev) => (prev || []).filter(u => u.id !== userId))

    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' })
      const result = await response.json()

      if (!response.ok) {
        if (result.needsConfig) {
          const supabaseUntyped = createUntypedClient()
          await supabaseUntyped.from('profiles').delete().eq('id', userId)
        } else {
          // Rollback
          mutate(previousUsers)
          alert('Erreur: ' + result.error)
          return
        }
      }
    } catch (error) {
      const supabaseUntyped = createUntypedClient()
      await supabaseUntyped.from('profiles').delete().eq('id', userId)
    }
  }

  const filteredUsers = (users || []).filter(user => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search)
    )
  })

  const onlineCount = filteredUsers.filter(u => u.is_online).length
  const activeUsers = filteredUsers.filter(u => u.status === 'active').length
  const managerCount = filteredUsers.filter(u => u.role === 'manager').length
  const vendeuseCount = filteredUsers.filter(u => u.role === 'vendeuse').length

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
      admin: 'danger', manager: 'warning', vendeuse: 'success'
    }
    return variants[role] || 'default'
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = { admin: 'Admin', manager: 'Manager', vendeuse: 'Vendeuse' }
    return labels[role] || role
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const selectedUser = (users || []).find(u => u.id === selectedUserId)

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Utilisateurs</h1>
          <p className="text-gray-600 mt-2">Gérez les comptes utilisateurs</p>
        </div>
        <Button onClick={() => {
          setEditingUser(null)
          setFormData({ email: '', name: '', role: 'vendeuse', status: 'active', password: '' })
          setShowModal(true)
        }}>
          + Nouvel Utilisateur
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredUsers.length}</div>
            <p className="text-sm text-gray-600">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
            <p className="text-sm text-gray-600">En ligne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-sm text-gray-600">Actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{managerCount}</div>
            <p className="text-sm text-gray-600">Managers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{vendeuseCount}</div>
            <p className="text-sm text-gray-600">Vendeuses</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Rechercher par nom, email ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-6"><SkeletonTable rows={5} /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun utilisateur trouvé</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Utilisateur</th>
                    <th className="text-left py-3 px-2 font-medium">Rôle</th>
                    <th className="text-left py-3 px-2 font-medium">Statut</th>
                    <th className="text-left py-3 px-2 font-medium">Connexion</th>
                    <th className="text-left py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-medium">
                              {user.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${user.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={getRoleBadge(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={user.status === 'active' ? 'success' : 'danger'}>
                          {user.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-sm">
                          {user.is_online ? (
                            <span className="text-green-600 font-medium">En ligne</span>
                          ) : user.last_seen ? (
                            <span className="text-gray-500">Vu {formatDateTime(user.last_seen)}</span>
                          ) : (
                            <span className="text-gray-400">Jamais connecté</span>
                          )}
                        </div>
                        <button
                          onClick={() => loadUserSessions(user.id)}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          Voir l'historique
                        </button>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                            Modifier
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleResetPassword(user.id, user.name)} className="text-orange-600">
                            MDP
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleToggleStatus(user.id, user.status)}>
                            {user.status === 'active' ? 'Désactiver' : 'Activer'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id, user.name)} className="text-red-600">
                            Suppr.
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Aucune activité récente</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sessions.slice(0, 20).map((session) => (
                <div key={session.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${session.action === 'login' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <span className="font-medium">{session.profiles?.name || 'Utilisateur'}</span>
                      <span className="text-gray-500 ml-2">
                        {session.action === 'login' ? 's\'est connecté' : 's\'est déconnecté'}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{formatDateTime(session.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingUser(null) }}
        title={editingUser ? 'Modifier l\'Utilisateur' : 'Nouvel Utilisateur'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nom complet"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={!!editingUser}
          />
          {!editingUser && (
            <Input
              label="Mot de passe"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="Minimum 6 caractères"
            />
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Rôle</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="vendeuse">Vendeuse</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Statut</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); setEditingUser(null) }}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'En cours...' : (editingUser ? 'Mettre à jour' : 'Créer')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Historique de connexion - ${selectedUser?.name || ''}`}
        size="lg"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun historique de connexion</p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${session.action === 'login' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {session.action === 'login' ? '→' : '←'}
                  </div>
                  <div>
                    <span className="font-medium">
                      {session.action === 'login' ? 'Connexion' : 'Déconnexion'}
                    </span>
                  </div>
                </div>
                <span className="text-gray-500">{formatDateTime(session.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
