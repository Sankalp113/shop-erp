'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/context/AuthContext'
import { logout } from '@/lib/firebase/auth'
import { cn, initials } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Users, UserCheck,
  Users2, DollarSign, Zap, BarChart3, Bell, FolderOpen, Settings,
  ChevronDown, LogOut, Menu, X, Store, Wallet, ChevronRight,
} from 'lucide-react'

interface NavItem {
  label: string; icon: React.ReactNode; href?: string
  children?: { label: string; href: string; icon?: React.ReactNode }[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, href: '/dashboard' },
  {
    label: 'Sales', icon: <ShoppingCart size={18} />,
    children: [
      { label: 'New Bill (POS)', href: '/dashboard/sales/new' },
      { label: 'Sales History', href: '/dashboard/sales/history' },
      { label: 'Returns & Exchange', href: '/dashboard/sales/returns' },
    ],
  },
  {
    label: 'Products & Stock', icon: <Package size={18} />,
    children: [
      { label: 'Products', href: '/dashboard/products' },
      { label: 'Categories & Brands', href: '/dashboard/products/categories' },
      { label: 'Stock Overview', href: '/dashboard/inventory/stock' },
      { label: 'Stock Adjustments', href: '/dashboard/inventory/adjustments' },
      { label: 'Low Stock', href: '/dashboard/inventory/low-stock' },
      { label: 'Stock Aging', href: '/dashboard/inventory/aging' },
    ],
  },
  {
    label: 'Purchases', icon: <Truck size={18} />,
    children: [
      { label: 'New Purchase', href: '/dashboard/purchases/new' },
      { label: 'Purchase History', href: '/dashboard/purchases/history' },
    ],
  },
  {
    label: 'Vendors', icon: <Store size={18} />,
    children: [
      { label: 'Vendor List', href: '/dashboard/vendors' },
      { label: 'Outstanding', href: '/dashboard/vendors/outstanding' },
    ],
  },
  {
    label: 'Customers', icon: <Users size={18} />,
    children: [
      { label: 'Customer List', href: '/dashboard/customers' },
      { label: 'Credit Outstanding', href: '/dashboard/customers/credit' },
    ],
  },
  {
    label: 'Staff', icon: <UserCheck size={18} />,
    children: [
      { label: 'Employees', href: '/dashboard/staff/employees' },
      { label: 'Attendance', href: '/dashboard/staff/attendance' },
      { label: 'Salary', href: '/dashboard/staff/salary' },
    ],
  },
  {
    label: 'Expenses', icon: <DollarSign size={18} />,
    children: [
      { label: 'Miscellaneous', href: '/dashboard/expenses/misc' },
      { label: 'Electricity Bills', href: '/dashboard/expenses/electricity' },
      { label: 'Rent', href: '/dashboard/expenses/rent' },
      { label: 'Recurring', href: '/dashboard/expenses/recurring' },
    ],
  },
  {
    label: 'Accounts', icon: <Wallet size={18} />,
    children: [
      { label: 'Cash Book', href: '/dashboard/finance/cash' },
      { label: 'Bank Accounts', href: '/dashboard/finance/bank' },
      { label: 'Day Reconciliation', href: '/dashboard/finance/reconciliation' },
    ],
  },
  { label: 'Reports', icon: <BarChart3 size={18} />, href: '/dashboard/reports' },
  { label: 'Reminders', icon: <Bell size={18} />, href: '/dashboard/reminders' },
  { label: 'Documents', icon: <FolderOpen size={18} />, href: '/dashboard/documents' },
  {
    label: 'Admin', icon: <Users2 size={18} />,
    children: [
      { label: 'Users & Roles', href: '/dashboard/admin/users' },
      { label: 'Audit Log', href: '/dashboard/admin/audit' },
      { label: 'Settings', href: '/dashboard/admin/settings' },
    ],
  },
]

export default function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const pathname = usePathname()
  const { profile } = useAuth()
  const [openGroup, setOpenGroup] = useState<string | null>(
    NAV.find(n => n.children?.some(c => pathname.startsWith(c.href)))?.label ?? null
  )

  async function handleLogout() {
    await logout()
    toast.success('Logged out')
  }

  return (
    <aside className={cn('sidebar', collapsed && 'collapsed')}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.07] min-h-[64px] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
          <span className="text-lg">👔</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-white whitespace-nowrap">Cloth Shop ERP</div>
            <div className="text-xs text-gray-600 whitespace-nowrap">Business Management</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {NAV.map(item => {
          const isActive = item.href ? pathname === item.href : item.children?.some(c => pathname.startsWith(c.href))
          const isOpen = openGroup === item.label

          if (item.href) {
            return (
              <Link key={item.label} href={item.href}
                className={cn('nav-item', isActive && 'active')}>
                <span className="flex-shrink-0 w-[18px]">{item.icon}</span>
                {!collapsed && <span className="nav-label text-sm">{item.label}</span>}
              </Link>
            )
          }

          return (
            <div key={item.label}>
              <button
                onClick={() => setOpenGroup(isOpen ? null : item.label)}
                className={cn('nav-item w-full', isActive && 'active')}>
                <span className="flex-shrink-0 w-[18px]">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left text-sm">{item.label}</span>
                    <ChevronDown size={14} className={cn('transition-transform duration-200', isOpen && 'rotate-180')} />
                  </>
                )}
              </button>
              {!collapsed && isOpen && (
                <div className="bg-black/20">
                  {item.children?.map(child => (
                    <Link key={child.href} href={child.href}
                      className={cn('nav-sub-item', pathname === child.href && 'active text-violet-300')}>
                      <ChevronRight size={12} className="flex-shrink-0" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User Footer */}
      {!collapsed && profile && (
        <div className="flex-shrink-0 border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#06B6D4)' }}>
              {initials(profile.name || 'U')}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold text-gray-300 truncate">{profile.name}</div>
              <div className="text-xs text-gray-600 capitalize">{profile.role}</div>
            </div>
            <button onClick={handleLogout} className="text-gray-600 hover:text-red-400 transition-colors" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
