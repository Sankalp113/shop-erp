import React, { useState, useEffect } from 'react'
import { getCategories, getStock } from '../../services/db'

export default function StockOverview() {
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catId, setCatId] = useState('')
  const [categories, setCategories] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => { getCategories().then(setCategories) }, [])
  useEffect(() => { load() }, [search, catId, page])

  async function load() {
    setLoading(true)
    const r = await getStock({ search, category_id: catId })
    setStock(r.data); setTotal(r.total); setLoading(false)
  }

  const totalValue = stock.reduce((s, p) => s + p.total_stock * p.purchase_price, 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div><h1>📦 Stock Overview</h1><p>Current inventory levels — {total} products</p></div>
        <div className="stat-chip"><span className="stat-chip-value">₹{totalValue.toLocaleString('en-IN')}</span><span className="stat-chip-label">Stock Value</span></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-control" placeholder="🔍 Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ flex: 1 }} />
        <select className="form-control" value={catId} onChange={e => { setCatId(e.target.value); setPage(1) }} style={{ width: 180 }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : stock.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📦</div><h3>No stock records</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Code</th><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Min Level</th><th style={{ textAlign: 'right' }}>Stock</th><th style={{ textAlign: 'right' }}>Purchase</th><th style={{ textAlign: 'right' }}>Sell</th><th style={{ textAlign: 'right' }}>Stock Value</th><th>Status</th></tr></thead>
                <tbody>{stock.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.product_code}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td style={{ fontSize: 12 }}>{p.category_name || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{p.min_stock_level}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: p.total_stock <= 0 ? 'var(--danger)' : p.total_stock <= p.min_stock_level ? 'var(--warning)' : 'var(--success)' }}>{p.total_stock}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>₹{p.purchase_price?.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>₹{p.selling_price?.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>₹{(p.total_stock * p.purchase_price).toLocaleString('en-IN')}</td>
                    <td>{p.total_stock <= 0 ? <span className="badge badge-danger">Out of Stock</span> : p.total_stock <= p.min_stock_level ? <span className="badge badge-warning">Low Stock</span> : <span className="badge badge-success">In Stock</span>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
      {total > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page}</span>
          <button className="btn btn-secondary btn-sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
