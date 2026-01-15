'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import toast from 'react-hot-toast'

interface Settings {
  id?: string
  store_name: string
  email: string
  currency: string
  tax_rate: number
  dark_mode: boolean
  logo_url?: string
  phone?: string
  address?: string
  tagline?: string
  receipt_footer?: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    store_name: 'RetailOS Store',
    email: '',
    currency: 'XAF',
    tax_rate: 0,
    dark_mode: false,
    logo_url: '',
    phone: '',
    address: '',
    tagline: 'Votre Boutique Mode',
    receipt_footer: 'Merci de votre visite !'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const supabase = createClient()
  const supabaseUntyped = createUntypedClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading settings:', error)
    } else if (data) {
      setSettings(data)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabaseUntyped = createUntypedClient()
    try {
      if (settings.id) {
        const { error } = await supabaseUntyped
          .from('settings')
          .update({
            store_name: settings.store_name,
            email: settings.email,
            currency: settings.currency,
            tax_rate: settings.tax_rate,
            dark_mode: settings.dark_mode,
            logo_url: settings.logo_url,
            phone: settings.phone,
            address: settings.address,
            tagline: settings.tagline,
            receipt_footer: settings.receipt_footer,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id)

        if (error) throw error
      } else {
        const { data, error } = await supabaseUntyped
          .from('settings')
          .insert({
            store_name: settings.store_name,
            email: settings.email,
            currency: settings.currency,
            tax_rate: settings.tax_rate,
            dark_mode: settings.dark_mode,
            logo_url: settings.logo_url,
            phone: settings.phone,
            address: settings.address,
            tagline: settings.tagline,
            receipt_footer: settings.receipt_footer
          })
          .select()
          .single()

        if (error) throw error
        setSettings(data)
      }

      toast.success('Paramètres enregistrés')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2MB')
      return
    }

    setUploadingLogo(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo_${Date.now()}.${fileExt}`
      const filePath = `store/${fileName}`

      const { data, error } = await supabaseUntyped.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (error) {
        // Fallback: convertir en base64
        const reader = new FileReader()
        reader.onloadend = () => {
          setSettings({ ...settings, logo_url: reader.result as string })
          toast.success('Logo chargé (mode local)')
        }
        reader.readAsDataURL(file)
        return
      }

      const { data: urlData } = supabaseUntyped.storage
        .from('images')
        .getPublicUrl(filePath)

      setSettings({ ...settings, logo_url: urlData.publicUrl })
      toast.success('Logo téléchargé !')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Erreur lors du téléchargement')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleExportData = async () => {
    try {
      const [
        { data: products },
        { data: clients },
        { data: sales },
        { data: profiles }
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('sales').select('*, sale_items(*)'),
        supabase.from('profiles').select('id, name, email, role')
      ])

      const exportData = {
        products,
        clients,
        sales,
        users: profiles,
        settings,
        exportedAt: new Date().toISOString()
      }

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2))
      const link = document.createElement('a')
      link.setAttribute('href', dataStr)
      link.setAttribute('download', `retailos_backup_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success('Données exportées')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Erreur lors de l\'export')
    }
  }

  const handleResetApp = async () => {
    const confirm1 = window.confirm(
      'ACTION IRRÉVERSIBLE : Voulez-vous vraiment réinitialiser toutes les données de l\'application ?'
    )
    if (!confirm1) return

    const confirm2 = window.confirm(
      'DERNIÈRE CONFIRMATION : Toutes les ventes, clients et produits seront supprimés. Continuer ?'
    )
    if (!confirm2) return

    setResetting(true)
    
    try {
      // Delete in order to respect foreign keys
      // Using gte with a very old date to match all records
      const deleteAll = async (table: string) => {
        const { error } = await supabaseUntyped
          .from(table)
          .delete()
          .gte('created_at', '1970-01-01')
        
        if (error) {
          console.error(`Error deleting ${table}:`, error)
          // Try alternative method
          const { error: error2 } = await supabaseUntyped
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')
          
          if (error2) {
            console.error(`Alternative delete failed for ${table}:`, error2)
          }
        }
      }

      // Delete in correct order (children first, then parents)
      await deleteAll('sale_items')
      await deleteAll('sales')
      await deleteAll('refunds')
      await deleteAll('cash_withdrawals')
      await deleteAll('cash_register')
      await deleteAll('audit_logs')
      await deleteAll('product_variants')
      await deleteAll('products')
      await deleteAll('clients')

      toast.success('Application réinitialisée avec succès!')
      
      // Wait a bit before reload
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error resetting app:', error)
      toast.error('Erreur lors de la réinitialisation')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-gray-600 mt-1">Configurez votre application</p>
      </div>

      {/* Store Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du Magasin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo de la boutique (pour les tickets)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden">
                {settings.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Icon name="image" className="text-3xl text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className={`inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploadingLogo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <Icon name="upload" className="mr-2" />
                      Télécharger un logo
                    </>
                  )}
                </label>
                {settings.logo_url && (
                  <button
                    onClick={() => setSettings({ ...settings, logo_url: '' })}
                    className="ml-2 text-red-500 hover:text-red-700 text-sm"
                  >
                    Supprimer
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-1">PNG ou JPG, max 2MB. Recommandé: fond transparent.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du magasin
              </label>
              <Input
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                placeholder="RetailOS Store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slogan / Tagline
              </label>
              <Input
                value={settings.tagline || ''}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                placeholder="Votre Boutique Mode"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <Input
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+241 XX XX XX XX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de contact
              </label>
              <Input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="contact@store.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse
            </label>
            <Input
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="123 Rue du Commerce, Libreville"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message de pied de ticket
            </label>
            <Input
              value={settings.receipt_footer || ''}
              onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
              placeholder="Merci de votre visite !"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Devise
              </label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="XAF">XAF (FCFA)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="XOF">XOF (FCFA Ouest)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taux de TVA (%)
              </label>
              <Input
                type="number"
                value={settings.tax_rate}
                onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="darkMode"
              checked={settings.dark_mode}
              onChange={(e) => setSettings({ ...settings, dark_mode: e.target.checked })}
              className="rounded text-primary"
            />
            <label htmlFor="darkMode" className="text-sm text-gray-700">
              Mode sombre (bientôt disponible)
            </label>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Gestion des Données</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleExportData}
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Icon name="download" className="mr-2" />
              Exporter toutes les données
            </button>

            <button
              onClick={handleResetApp}
              disabled={resetting}
              className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              <Icon name={resetting ? 'hourglass_empty' : 'delete_forever'} className="mr-2" />
              {resetting ? 'Réinitialisation en cours...' : 'Réinitialiser l\'application'}
            </button>
          </div>

          <p className="text-sm text-gray-500">
            L'export crée une sauvegarde JSON de toutes vos données. 
            La réinitialisation supprime définitivement toutes les ventes, clients et produits.
          </p>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>À propos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Image 
              src="/icons/icon-96x96.png" 
              alt="RetailOS" 
              width={64} 
              height={64} 
              className="rounded-2xl shadow-lg"
            />
            <div>
              <h3 className="text-xl font-bold">RetailOS</h3>
              <p className="text-gray-500">Version 2.0 - Next.js Edition</p>
              <p className="text-sm text-gray-400 mt-1">
                Système de point de vente moderne
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
