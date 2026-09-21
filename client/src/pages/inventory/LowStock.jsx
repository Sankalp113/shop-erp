import React, { useState, useEffect } from 'react'
import { getLowStock } from '../../services/db'

export default function LowStock() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getLowStock().then(p => { setProducts(p); setLoading(false) }) }, [])

  return (
    <div>
      <div className="page-header"><h1>⚠️ Low Stock Alert</h1><p>{products.length} products need restocking</p></div>
      {products.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⚠️ <strong>{products.length} products</strong> have stock at or below minimum level. Consider placing purchase orders.
        </div>
      )}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : products.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">✅</div><h3>All products are well stocked!</h3><p>No products below minimum stock level.</p></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Code</th><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Min Level</th><th style={{ textAlign: 'right' }}>Current Stock</th><th style={{ textAlign: 'right' }}>Deficit</th><th>Sell Price</th><th>Action</th></tr></thead>
                <tbody>{products.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.product_code}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td style={{ fontSize: 12 }}>{p.category_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{p.min_stock_level}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: p.total_stock <= 0 ? 'var(--danger)' : 'var(--warning)' }}>{p.total_stock}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>{Math.max(0, p.min_stock_level - p.total_stock)}</td>
                    <td>₹{p.selling_price?.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${p.total_stock <= 0 ? 'badge-danger' : 'badge-warning'}`}>{p.total_stock <= 0 ? '🚫 Out of Stock' : '⚠️ Low Stock'}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
    </div>
  )
}
