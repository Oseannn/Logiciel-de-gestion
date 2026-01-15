'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function SetupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          storeName: formData.storeName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création')
      }

      toast.success('Compte admin créé avec succès !')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex w-1/2 bg-bgDark relative items-center justify-center p-12">
        <div className="relative z-10 text-white max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <Image 
              src="/icons/icon-128x128.png" 
              alt="RetailOS" 
              width={64} 
              height={64} 
              className="rounded-2xl shadow-2xl"
            />
            <h1 className="text-4xl font-bold">RetailOS</h1>
          </div>
          <p className="text-xl text-gray-300 leading-relaxed mb-4">
            Bienvenue ! Configurez votre boutique en quelques étapes.
          </p>
          <ul className="space-y-3 text-gray-400">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm">1</span>
              Créez votre compte administrateur
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm">2</span>
              Ajoutez vos produits
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm">3</span>
              Commencez à vendre !
            </li>
          </ul>
        </div>
      </div>

      {/* Right Side - Setup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <Image 
              src="/icons/icon-128x128.png" 
              alt="RetailOS" 
              width={80} 
              height={80} 
              className="rounded-2xl shadow-lg"
            />
          </div>
          
          <div>
            <h2 className="text-3xl font-bold">Configuration initiale</h2>
            <p className="mt-2 text-sm text-gray-500">
              Créez votre compte administrateur pour commencer
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la boutique
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Ma Boutique"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Votre nom
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Jean Dupont"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="admin@maboutique.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors mt-6"
            >
              {loading ? 'Création en cours...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Vous avez déjà un compte ?{' '}
            <a href="/login" className="text-primary font-medium hover:underline">
              Se connecter
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
