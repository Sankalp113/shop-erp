'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/context/AuthContext'
import { Bell, Menu, Search, X, Plus } from 'lucide-react'
import { cn, initials } from '@/lib/utils'

// Map path prefixes to human-readable page titles
const TITLE_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/sales/new': 'New Sale (POS)',
  '/dashboard/sales/history': 'Sales History',
  '/dashboard/sales/returns': 'Sales Returns',
  '/dashboard/products': 'Products',
  '/dashboard/products/categories': 'Categories & Brands',
  '/dashboard/inventory/stock': 'Stock Overview',
  '/dashboard/inventory/adjustments': 'Stock Adjustments',
  '/dashboard/inventory/low-stock': 'Low Stock',
  '/dashboard/inventory/aging': 'Stock Aging',
  '/dashboard/purchases/new': 'New Purchase',
  '/dashboard/purchases/history': 'Purchase History',
  '/dashboard/vendors': 'Vendors',
  '/dashboard/vendors/outstanding': 'Vendor Outstanding',
  '/dashboard/customers': 'Customers',
  '/dashboard/customers/credit': 'Credit Outstanding',
  '/dashboard/staff/employees': 'Employees',
  '/dashboard/staff/attendance': 'Attendance',
  '/dashboard/staff/salary': 'Salary',
  '/dashboard/expenses/misc': 'Miscellaneous Expenses',
  '/dashboard/expenses/electricity': 'Electricity Bills',
  '/dashboard/expenses/rent': 'Shop Rent',
  '/dashboard/expenses/recurring': 'Recurring Expenses',
  '/dashboard/finance/cash': 'Cash Book',
  '/dashboard/finance/bank': 'Bank Accounts',
  '/dashboard/finance/reconciliation': 'Day Reconciliation',
  '/dashboard/reports': 'Reports',
  '/dashboard/reminders': 'Reminders & Alerts',
  '/dashboard/documents': 'Documents',
  '/dashboard/admin/users': 'Users & Roles',
  '/dashboard/admin/audit': 'Audit Log',
  '/dashboard/admin/settings': 'Settings',
}

function getTitle(pathname: string) {
  return TITLE_MAP[pathname] ?? TITLE_MAP[Object.keys(TITLE_MAP).find(k => pathname.startsWith(k) && k !== '/dashboard') ?? ''] ?? 'Dashboard'
}

export default function Topbar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const { profile } = useAuth()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const title = getTitle(pathname)
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 border-b border-white/[0.07]"
      style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(20px)' }}>

      {/* Toggle */}
      <button onClick={onToggle}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h2 className="text-sm font-semibold text-gray-300 hidden sm:block">{title}</h2>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Date/Time */}
      <div className="hidden md:flex flex-col items-end text-right">
        <span className="text-xs font-semibold text-gray-400">{timeStr}</span>
        <span className="text-xs text-gray-600">{dateStr}</span>
      </div>

      {/* Quick action — New Sale */}
      <Link href="/dashboard/sales/new"
        className="btn btn-primary btn-sm hidden sm:inline-flex">
        <Plus size={14} /> New Bill
      </Link>

      {/* Reminders */}
      <Link href="/dashboard/reminders"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all relative">
        <Bell size={18} />
      </Link>

      {/* User avatar */}
      {profile && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer hover:scale-105 transition-transform"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)' }}
          title={profile.name}>
          {initials(profile.name || 'U')}
        </div>
      )}
    </header>
  )
}
