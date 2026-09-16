'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/context/AuthContext'
import { formatCurrency, todayStr, formatDate } from '@/lib/utils'
import {
  TrendingUp, ShoppingCart, DollarSign, Users, Package, AlertTriangle,
  ArrowRight, ShoppingBag, Clock, Plus, Wifi, WifiOff,
} from 'lucide-react'
import {
  collection, doc, onSnapshot, query,
  where, orderBy, limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, icon, pulse,
}: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode; pulse?: boolean }) {
  return (
    <div className="kpi-card" style={{ '--kpi-accent': color } as any}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1.5">
          {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, color }}>
            {icon}
          </div>
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  )
}

const QUICK_ACTIONS = [
  { label: 'New Bill',      href: '/dashboard/sales/new',            icon: '🧾', color: '#7C3AED' },
  { label: 'Add Product',   href: '/dashboard/products',             icon: '📦', color: '#06B6D4' },
  { label: 'New Purchase',  href: '/dashboard/purchases/new',        icon: '🚚', color: '#10B981' },
  { label: 'Add Customer',  href: '/dashboard/customers',            icon: '👤', color: '#F59E0B' },
  { label: 'Add Vendor',    href: '/dashboard/vendors',              icon: '🏭', color: '#EF4444' },
  { label: 'Add Expense',   href: '/dashboard/expenses/misc',        icon: '💸', color: '#8B5CF6' },
  { label: 'Stock Adj.',    href: '/dashboard/inventory/adjustments', icon: '📊', color: '#06B6D4' },
  { label: 'Reports',       href: '/dashboard/reports',              icon: '📈', color: '#10B981' },
]

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile } = useAuth()
  const today = todayStr()

  const [summary,      setSummary]      = useState<any>(null)
  const [custOutstanding, setCustOut]   = useState(0)
  const [vendOutstanding, setVendOut]   = useState(0)
  const [cashBalance,  setCashBalance]  = useState(0)
  const [reminders,    setReminders]    = useState<any[]>([])
  const [lowStock,     setLowStock]     = useState<any[]>([])
  const [connected,    setConnected]    = useState(true)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    const unsubs: (() => void)[] = []

    // 1. Daily summary — live KPIs
    unsubs.push(onSnapshot(
      doc(db, 'dailySummaries', today),
      snap => { setSummary(snap.exists() ? snap.data() : {}); setLoading(false); setConnected(true) },
      () => { setConnected(false); setLoading(false) }
    ))

    // 2. Customer outstanding
    unsubs.push(onSnapshot(
      query(collection(db, 'customers'), where('outstanding', '>', 0)),
      snap => setCustOut(snap.docs.reduce((s, d) => s + (d.data().outstanding || 0), 0))
    ))

    // 3. Vendor outstanding
    unsubs.push(onSnapshot(
      query(collection(db, 'vendors'), where('outstanding', '>', 0)),
      snap => setVendOut(snap.docs.reduce((s, d) => s + (d.data().outstanding || 0), 0))
    ))

    // 4. Cash balance
    unsubs.push(onSnapshot(
      doc(db, 'settings', 'cashBalance'),
      snap => { if (snap.exists()) setCashBalance(Number(snap.data().value) || 0) }
    ))

    // 5. Reminders
    unsubs.push(onSnapshot(
      query(
        collection(db, 'reminders'),
        where('status', 'in', ['upcoming', 'due_soon', 'due_today', 'overdue']),
        orderBy('dueDate'),
        limit(20)
      ),
      snap => setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))

    // 6. Low stock
    unsubs.push(onSnapshot(
      query(collection(db, 'products'), where('isActive', '==', true)),
      snap => setLowStock(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((p: any) => !p.hasVariants && (p.currentStock ?? 0) <= (p.minStock || 5))
      )
    ))

    return () => unsubs.forEach(u => u())
  }, [today])

  const fc = formatCurrency
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">
            Good {greeting}, {profile?.name?.split(' ')[0] || 'Owner'} 👋
          </h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            connected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {connected
              ? <><Wifi size={11}/><span className="font-medium">Live</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/></>
              : <><WifiOff size={11}/><span>Offline</span></>
            }
          </div>
          <Link href="/dashboard/sales/new" className="btn btn-primary">
            <Plus size={16} /> New Bill
          </Link>
        </div>
      </div>

      {/* Today's KPIs */}
      <div>
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
          Today's Summary — Updates Instantly
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KpiCard pulse label="Total Sales"   value={fc(summary?.totalSales)}   sub={`${summary?.totalBills || 0} bills`} color="#7C3AED" icon={<ShoppingCart size={16}/>}/>
          <KpiCard pulse label="Cash Sales"    value={fc(summary?.cashSales)}    color="#10B981" icon={<DollarSign size={16}/>}/>
          <KpiCard pulse label="UPI Sales"     value={fc(summary?.upiSales)}     color="#06B6D4" icon={<TrendingUp size={16}/>}/>
          <KpiCard pulse label="Credit Sales"  value={fc(summary?.creditSales)}  color="#F59E0B" icon={<Users size={16}/>}/>
          <KpiCard pulse label="Gross Profit"  value={fc(summary?.grossProfit)}  color="#10B981" icon={<TrendingUp size={16}/>}/>
        </div>
      </div>

      {/* Business Position */}
      <div>
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Business Position</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard pulse label="Cash Available"   value={fc(cashBalance)}          color="#10B981" icon={<DollarSign size={16}/>}/>
          <KpiCard pulse label="Purchases Today"  value={fc(summary?.totalPurchases)} color="#EF4444" icon={<ShoppingBag size={16}/>}/>
          <KpiCard pulse label="Expenses Today"   value={fc(summary?.totalExpenses)}  color="#F59E0B" icon={<DollarSign size={16}/>}/>
          <KpiCard pulse label="Customer O/S"     value={fc(custOutstanding)}      color="#F59E0B" icon={<Users size={16}/>} sub="receivable"/>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <KpiCard pulse label="Vendor O/S"      value={fc(vendOutstanding)}      color="#EF4444" icon={<ShoppingBag size={16}/>} sub="payable"/>
          <KpiCard pulse label="Low Stock"        value={String(lowStock.length)}  color="#F59E0B" icon={<Package size={16}/>} sub="need restocking"/>
          <KpiCard pulse label="Pending Alerts"   value={String(reminders.length)} color="#EF4444" icon={<AlertTriangle size={16}/>}/>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Actions */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-gray-300 mb-4">⚡ Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(a => (
              <Link key={a.href} href={a.href}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-white/5 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:-translate-y-0.5"
                  style={{ background: `${a.color}22`, border: `1px solid ${a.color}44` }}>
                  {a.icon}
                </div>
                <span className="text-xs text-gray-500 text-center leading-tight group-hover:text-gray-300 transition-colors">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-300">🔔 Alerts <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block ml-1"/></h3>
            <Link href="/dashboard/reminders" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ArrowRight size={12}/>
            </Link>
          </div>
          {loading ? (
            <div className="loading-overlay"><div className="spinner"/></div>
          ) : reminders.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-icon">✅</div>
              <p className="text-sm text-gray-500">No pending alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.slice(0, 5).map((r: any) => (
                <div key={r.id} className={`alert-item ${r.status === 'overdue' ? 'overdue' : r.status === 'due_today' ? 'warning' : 'info'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === 'overdue' ? 'bg-red-500' : r.status === 'due_today' ? 'bg-amber-500' : 'bg-blue-500'}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-300 truncate">{r.title}</div>
                    <div className="text-xs text-gray-600">{formatDate(r.dueDate)}</div>
                  </div>
                  {r.amount && <span className="text-xs font-semibold text-amber-400 flex-shrink-0">{fc(r.amount)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-300">📦 Low Stock <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block ml-1"/></h3>
            <Link href="/dashboard/inventory/low-stock" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ArrowRight size={12}/>
            </Link>
          </div>
          {loading ? (
            <div className="loading-overlay"><div className="spinner"/></div>
          ) : lowStock.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-icon">✅</div>
              <p className="text-sm text-gray-500">All products in stock</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map((p: any, i) => (
                <div key={p.id || i} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-300 truncate">{p.name || p.productName}</div>
                    {(p.size || p.color) && <div className="text-xs text-gray-600">{[p.size, p.color].filter(Boolean).join(' / ')}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-red-400">{p.currentStock ?? p.quantity ?? 0}</div>
                    <div className="text-xs text-gray-600">of {p.minStock || 5}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
