import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('erp_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password })
    localStorage.setItem('erp_token', res.data.token)
    localStorage.setItem('erp_user', JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }

  function logout() {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
