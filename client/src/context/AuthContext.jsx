import React, { createContext, useContext, useState, useEffect } from 'react'
import { signIn, signOut, onAuthChange, initializeShop } from '../services/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      // Initialize default data on first login
      if (firebaseUser) {
        try { await initializeShop() } catch (e) {}
      }
    })
    return unsubscribe
  }, [])

  async function login(username, password) {
    const userData = await signIn(username, password)
    setUser(userData)
    return userData
  }

  async function logout() {
    await signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {loading
        ? <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
            <span className="loading-spinner" style={{ width: 40, height: 40 }} />
          </div>
        : children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
