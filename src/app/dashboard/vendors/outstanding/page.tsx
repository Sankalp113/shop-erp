'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency } from '@/lib/utils'
import { Store, AlertTriangle } from 'lucide-react'

export default function VendorOutstandingPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'outstanding'>('outstanding')
  const [search, setSearch]   = useState('')

  useEffect(() => {
    setLoading(true)
    const q = filter === 'outstanding'
      ? query(collection(db, 'vendors'), where('outstanding', '>', 0), orderBy('outstanding', 'desc'))
      : query(collection(db, 'vendors'), orderBy('name'))
    const unsub = onSnapshot(q,
      snap => { setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return () => unsub()
  }, [filter])

  const filtered  = vendors.filter(v => !search || v.name?.toLowerCase().includes(search.toLowerCase()) || v.phone?.includes(search))
  const totalOuts = vendors.reduce((s, v) => s + (v.outstanding || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Vendor Outstanding</h1>
          <p className="page-subtitle flex items-center gap-2">
            Total Payable: <span className="font-bold text-red-300">{formatCurrency(totalOuts)}</span>
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Live
            </span>
          </p>
        </div>
      </div>

      <div className="glass-card p-4 mb-5 flex gap-3 flex-wrap items-center">
        <input className="form-input flex-1 min-w-[200px]" placeholder="Search vendor, phone…"
          value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="tabs !mb-0">
          <button className={`tab ${filter === 'outstanding' ? 'active' : ''}`} onClick={() => setFilter('outstanding')}>Outstanding Only</button>
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Vendors</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Vendor Name</th><th>Phone</th>
                <th className="text-right">Total Purchased</th>
                <th className="text-right">Total Paid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
                : filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><Store size={40} className="opacity-30 mb-3"/><p>No vendors found</p></div></td></tr>
                : filtered.map((v, i) => {
                  const outs = v.outstanding || 0
                  return (
                    <tr key={v.id}>
                      <td className="text-gray-600 text-xs">{i + 1}</td>
                      <td><div className="font-semibold text-gray-200">{v.name}</div></td>
                      <td className="text-gray-500">{v.phone || '—'}</td>
                      <td className="text-right">{formatCurrency(v.totalPurchased || 0)}</td>
                      <td className="text-right text-emerald-300">{formatCurrency((v.totalPurchased || 0) - outs)}</td>
                      <td className={`text-right font-bold text-lg ${outs > 0 ? 'text-red-300' : 'text-gray-600'}`}>{formatCurrency(outs)}</td>
                      <td>
                        {outs > 0
                          ? <span className="badge badge-danger flex items-center gap-1"><AlertTriangle size={10}/> Pending</span>
                          : <span className="badge badge-success">Cleared</span>
                        }
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
