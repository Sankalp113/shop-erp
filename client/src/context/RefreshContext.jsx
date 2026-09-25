import React, { createContext, useContext, useState, useCallback } from 'react'

/**
 * DataRefreshContext — lightweight pub/sub for cross-page data invalidation.
 *
 * Usage in a mutation page (after save/delete):
 *   const { refresh } = useRefresh()
 *   refresh('stock', 'products')          // invalidates those namespaces
 *
 * Usage in a list/display page (to auto-reload when data changes):
 *   const { version } = useRefresh()
 *   useEffect(() => { load() }, [version.stock])
 *
 * Namespaces:
 *   'products'   — product catalog & stock counts
 *   'stock'      — stock overview / low stock / aging
 *   'purchases'  — purchase history
 *   'sales'      — sales history
 *   'customers'  — customer list / credit
 *   'vendors'    — vendor list / detail
 *   'expenses'   — expenses / electricity / rent
 *   'finance'    — cash book / bank accounts
 *   'staff'      — employees / attendance / salary
 *   'reminders'  — reminders
 */

const RefreshContext = createContext({ version: {}, refresh: () => {} })

export function RefreshProvider({ children }) {
  const [version, setVersion] = useState({})

  const refresh = useCallback((...namespaces) => {
    setVersion(v => {
      const next = { ...v }
      namespaces.forEach(ns => { next[ns] = (next[ns] || 0) + 1 })
      return next
    })
  }, [])

  return (
    <RefreshContext.Provider value={{ version, refresh }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  return useContext(RefreshContext)
}
