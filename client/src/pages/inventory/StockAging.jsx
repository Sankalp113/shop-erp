import React, { useState, useEffect } from 'react'
import { getStockAging } from '../../services/db'

const AGING_CATS = [
  { key: '0_30', label: '0–30 Days', color: 'var(--success)', desc: 'Fast moving' },
  { key: '31_60', label: '31–60 Days', color: 'var(--warning)', desc: 'Watch closely' },
  { key: '61_90', label: '61–90 Days', color: '#F97316', desc: 'Needs attention' },
  { key: '91_180', label: '91–180 Days', color: 'var(--danger)', desc: 'Consider discount' },
  { key: '180_plus', label: '180+ Days', color: '#9333EA', desc: 'Dead stock' },
]

export default function StockAging() {
  const [data, setData] = useState({})
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [selCat, setSelCat] = useState('all')

  useEffect(() => {
    getStockAging().then(r => { setData(r.categorized || {}); setAll(r.data || []) }).finally(() => setLoading(false))
  }, [])

  const displayData = selCat === 'all' ? all : (data[selCat] || [])

  return (
    <div>
      <div className="page-header"><h1>📅 Stock Aging Report</h1><p>Identify slow-moving and dead stock</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {AGING_CATS.map(cat => (
          <div key={cat.key} className="kpi-card" style={{ '--kpi-color': cat.color, cursor: 'pointer', border: selCat === cat.key ? `2px solid ${cat.color}` : '1px solid var(--border)' }} onClick={() => setSelCat(selCat === cat.key ? 'all' : cat.key)}>
            <div className="kpi-label">{cat.label}</div>
            <div className="kpi-value" style={{ color: cat.color }}>{(data[cat.key] || []).length}</div>
            <div className="kpi-sub">{cat.desc}</div>
          </div>
        ))}
      </div>
      <div className="date-filter">
        <button className={`date-filter-btn ${selCat === 'all' ? 'active' : ''}`} onClick={() => setSelCat('all')}>All ({all.length})</button>
        {AGING_CATS.map(c => <button key={c.key} className={`date-filter-btn ${selCat === c.key ? 'active' : ''}`} onClick={() => setSelCat(c.key)}>{c.label} ({(data[c.key] || []).length})</button>)}
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : displayData.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📅</div><h3>No products in this range</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Stock</th><th>Last Sold</th><th style={{ textAlign: 'right' }}>Age (Days)</th><th>Action</th></tr></thead>
                <tbody>{displayData.map(p => {
                  const cat = AGING_CATS.find(c => (data[c.key] || []).some(x => x.id === p.id))
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                      <td style={{ fontSize: 12 }}>{p.category_name || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.stock}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.last_sold_date ? p.last_sold_date.split('T')[0] : 'Never sold'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: cat?.color || 'var(--text-muted)' }}>{p.age_days}</td>
                      <td>{p.age_days > 180 ? <span className="badge badge-danger">Dead Stock</span> : p.age_days > 90 ? <span className="badge badge-warning">Offer Discount</span> : p.age_days > 60 ? <span className="badge badge-info">Monitor</span> : <span className="badge badge-success">Active</span>}</td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
          }
        </div>
      </div>
    </div>
  )
}
