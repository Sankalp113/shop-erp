import React, { createContext, useContext, useState } from 'react'

const AccountContext = createContext()

export function AccountProvider({ children }) {
  const [account, setAccount] = useState('Combined') // 'VR' | 'Janta' | 'Combined'
  return (
    <AccountContext.Provider value={{ account, setAccount }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
