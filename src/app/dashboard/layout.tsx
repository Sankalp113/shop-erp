'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/context/AuthContext'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading your workspace…</p>
      </div>
    </div>
  )

  if (!user) return null

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(mobileOpen && 'mobile-open')}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Main content */}
      <div className={cn('main-wrapper flex flex-col', collapsed && 'expanded')}>
        <Topbar collapsed={collapsed} onToggle={() => {
          if (window.innerWidth < 1024) setMobileOpen(v => !v)
          else setCollapsed(v => !v)
        }} />
        <main className="flex-1 p-6 page-content max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
