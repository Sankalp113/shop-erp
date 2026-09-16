'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency } from '@/lib/utils'
import { Users, AlertTriangle } from 'lucide-react'

export default function CustomerCreditPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'all' | 'outstanding'>('outstanding')
  const [search, setSearch]       = useState('')

  useEffect(() => {
    setLoading(true)
    const q = filter === 'outstanding'
      ? query(collection(db, 'customers'), where('outstanding', '>', 0), orderBy('outstanding', 'desc'))
      : query(collection(db, 'customers'), orderBy('name'))
    const unsub = onSnapshot(q,
      snap => { setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return () => unsub()
  }, [filter])

  const filtered  = customers.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
  const totalOuts = customers.reduce((s, c) => s + (c.outstanding || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Customer Credit Outstanding</h1>
          <p className="page-subtitle flex items-center gap-2">
            Total Receivable: <span className="font-bold text-amber-300">{formatCurrency(totalOuts)}</span>
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Live
            </span>
          </p>
        </div>
      </div>

      <div className="glass-card p-4 mb-5 flex gap-3 flex-wrap items-center">
        <input className="form-input flex-1 min-w-[200px]" placeholder="Search customer, phone…"
          value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="tabs !mb-0">
          <button className={`tab ${filter === 'outstanding' ? 'active' : ''}`} onClick={() => setFilter('outstanding')}>Outstanding Only</button>
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Customers</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Customer Name</th><th>Phone</th>
                <th className="text-right">Total Billed</th>
                <th className="text-right">Total Paid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
                : filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><Users size={40} className="opacity-30 mb-3"/><p>No customers found</p></div></td></tr>
                : filtered.map((c, i) => {
                  const outs = c.outstanding || 0
                  return (
                    <tr key={c.id}>
                      <td className="text-gray-600 text-xs">{i + 1}</td>
                      <td><div className="font-semibold text-gray-200">{c.name}</div></td>
                      <td className="text-gray-500">{c.phone || '—'}</td>
                      <td className="text-right">{formatCurrency(c.totalBilled || 0)}</td>
                      <td className="text-right text-emerald-300">{formatCurrency((c.totalBilled || 0) - outs)}</td>
                      <td className={`text-right font-bold text-lg ${outs > 0 ? 'text-amber-300' : 'text-gray-600'}`}>{formatCurrency(outs)}</td>
                      <td>
                        {outs > 0
                          ? <span className="badge badge-warning flex items-center gap-1"><AlertTriangle size={10}/> Outstanding</span>
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
