'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { Shield, Search } from 'lucide-react'

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'badge-success',
  EDIT:   'badge-info',
  DELETE: 'badge-danger',
}

export default function AuditLogPage() {
  const [logs, setLogs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(500))
    const unsub = onSnapshot(q,
      snap => { setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return () => unsub()
  }, [])

  const filtered = logs.filter(l =>
    !search ||
    l.module?.toLowerCase().includes(search.toLowerCase()) ||
    l.userName?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase())
  )

  function formatTs(ts: any): string {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle flex items-center gap-2">
            Every change recorded automatically
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Live
            </span>
          </p>
        </div>
      </div>

      <div className="glass-card p-4 mb-5 flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input className="form-input pl-9" placeholder="Search by module, user, action…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th><th>User</th><th>Action</th>
                <th>Module</th><th>Record ID</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
                : filtered.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><Shield size={40} className="opacity-30 mb-3"/><p>No audit records found</p></div></td></tr>
                : filtered.map(l => (
                  <tr key={l.id}>
                    <td className="text-xs text-gray-400 whitespace-nowrap">{formatTs(l.createdAt)}</td>
                    <td className="text-sm">{l.userName || l.userId || '—'}</td>
                    <td><span className={`badge ${ACTION_BADGE[l.action] || 'badge-muted'}`}>{l.action}</span></td>
                    <td><span className="badge badge-muted">{l.module}</span></td>
                    <td className="font-mono text-xs text-gray-600">{l.recordId?.slice(0, 12) || '—'}…</td>
                    <td className="text-xs text-gray-500 max-w-[200px] truncate">
                      {l.details ? JSON.stringify(l.details).slice(0, 60) : '—'}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
