'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { loginWithEmail } from '@/lib/firebase/auth'
import { useAuth } from '@/lib/context/AuthContext'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return toast.error('Enter email and password')
    setSubmitting(true)
    try {
      await loginWithEmail(email, password)
      toast.success('Login successful!')
      router.replace('/dashboard')
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.'
        : 'Login failed. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(124,58,237,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(6,182,212,0.06) 0%, transparent 60%), #050510' }}>

      {/* Decorative background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}>
            <span className="text-3xl">👔</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cloth Shop ERP</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@myshop.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : '🔐 Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-gray-600">Forgot password? Contact your system administrator</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          Cloth Shop ERP v1.0 · Secured by Firebase Authentication
        </p>
      </div>
    </div>
  )
}
