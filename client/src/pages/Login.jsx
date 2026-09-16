import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 20% 40%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(6,182,212,0.1) 0%, transparent 60%)',
      }} />

      <div style={{
        width: '100%', maxWidth: 420,
        padding: '0 24px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            borderRadius: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 36,
            boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
          }}>👗</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>Cloth Shop ERP</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            Complete Business Management System
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: 36,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Sign In</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
            Enter your credentials to access the system
          </p>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 20 }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-control"
                type="text"
                placeholder="Enter username"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 28 }}>
              <label className="form-label">Password</label>
              <input
                className="form-control"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ justifyContent: 'center', padding: '14px 24px', fontSize: 14 }}
            >
              {loading ? <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : '🔐 Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: 16, background: 'rgba(124,58,237,0.08)', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Default credentials:</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Username: <strong style={{ color: 'var(--primary-light)' }}>admin</strong></p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Password: <strong style={{ color: 'var(--primary-light)' }}>admin123</strong></p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
          © 2026 Cloth Shop ERP · Secure 24×7 Access
        </p>
      </div>
    </div>
  )
}
