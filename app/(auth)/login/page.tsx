'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient, createUntypedClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'vendeuse'>('admin')
  const [loading, setLoading] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkSetupNeeded()
  }, [])

  const checkSetupNeeded = async () => {
    try {
      const response = await fetch('/api/setup')
      const data = await response.json()
      
      if (data.needsSetup) {
        router.push('/setup')
        return
      }
    } catch (error) {
      console.error('Error checking setup:', error)
    } finally {
      setCheckingSetup(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', data.user.id)
          .single() as { data: { role: string; status: string } | null }

        // Vérifier si le compte est désactivé
        if (profile && profile.status === 'inactive') {
          toast.error('Votre compte a été désactivé. Contactez l\'administrateur.')
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        if (profile && profile.role === role) {
          // Enregistrer la connexion et mettre à jour le statut en ligne (non-bloquant)
          const supabaseUntyped = createUntypedClient()
          supabaseUntyped.from('user_sessions').insert({
            user_id: data.user.id,
            action: 'login'
          })
          
          supabaseUntyped.from('profiles').update({
            is_online: true,
            last_seen: new Date().toISOString()
          }).eq('id', data.user.id)
          
          toast.success('Connexion réussie !')
          router.push(`/${role}`)
        } else {
          toast.error(`Ce compte n'a pas les droits ${role}`)
          await supabase.auth.signOut()
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
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
          <p className="text-xl text-gray-300 leading-relaxed">
            Gérez votre boutique avec élégance et efficacité
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
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
            <h2 className="text-3xl font-bold">Bon retour !</h2>
            <p className="mt-2 text-sm text-gray-500">
              Connectez-vous à votre espace
            </p>
          </div>

          {/* Role Selector */}
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
            {(['admin', 'manager', 'vendeuse'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  role === r
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="votre@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
