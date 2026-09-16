'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import { ShoppingCart, Search } from 'lucide-react'

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth())
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(
        collection(db, 'sales'),
        where('saleDate', '>=', `${month}-01`),
        where('saleDate', '<=', `${month}-31`),
        orderBy('saleDate', 'desc'),
        limit(200)
      ))
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {}
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const filtered = sales.filter(s => !search || s.invoiceNumber?.includes(search) || s.customerName?.toLowerCase().includes(search.toLowerCase()))
  const total = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.totalAmount || 0), 0)

  const modeMap: Record<string, string> = { cash: 'badge-success', upi: 'badge-info', card: 'badge-primary', credit: 'badge-warning', split: 'badge-muted' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Sales History</h1><p className="page-subtitle">{sales.length} bills · {formatCurrency(total)}</p></div>
        <input type="month" className="form-input w-auto" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      <div className="glass-card p-4 mb-5 flex gap-3">
        <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input className="form-input pl-9" placeholder="Search invoice, customer…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th>Mode</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-10"><div className="spinner mx-auto" /></td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><ShoppingCart size={40} className="opacity-30 mb-3" /><p>No sales found</p></div></td></tr>
                  : filtered.map(s => (
                    <tr key={s.id}>
                      <td><span className="font-mono font-bold text-violet-300">{s.invoiceNumber}</span></td>
                      <td>{formatDate(s.saleDate)}</td>
                      <td>{s.customerName || 'Walk-in'}</td>
                      <td className="text-gray-500">—</td>
                      <td><span className={`badge ${modeMap[s.paymentMode] || 'badge-muted'} capitalize`}>{s.paymentMode}</span></td>
                      <td className="text-right font-bold text-gray-200">{formatCurrency(s.totalAmount)}</td>
                      <td><span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
