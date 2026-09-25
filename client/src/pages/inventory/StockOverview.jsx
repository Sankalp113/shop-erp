import React, { useState, useEffect } from 'react'
import { getCategories, getStock, getStockTransactions, getCategoriesTree } from '../../services/db'
import { useRefresh } from '../../context/RefreshContext'


const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

const TXN_COLOR = {
  sale: 'var(--danger)', purchase: 'var(--success)', return: 'var(--info)',
  adjustment: 'var(--warning)', opening: 'var(--text-muted)'
}
const TXN_ICON = {
  sale: '🧾', purchase: '📦', return: '↩️', adjustment: '⚖️', opening: '🏁'
}

export default function StockOverview() {
  const { version } = useRefresh()
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catId, setCatId] = useState('')
  const [catTree, setCatTree] = useState({ parents: [], children: {}, all: [] })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [historyModal, setHistoryModal] = useState(null)
  const [historyData, setHistoryData] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => { getCategoriesTree().then(setCatTree) }, [])
  useEffect(() => { load() }, [search, catId, page, version.stock, version.products])


  async function load() {
    setLoading(true)
    // When parent selected, include all subcategory products
    const catIds = (() => {
      if (!catId) return null
      const subs = catTree.children[catId]
      if (subs && subs.length > 0) return [catId, ...subs.map(s => s.id)]
      return null
    })()
    const r = await getStock({ search, category_id: catIds ? '' : catId, category_ids: catIds })
    setStock(r.data); setTotal(r.total); setLoading(false)
  }

  async function openHistory(product) {
    setHistoryModal(product)
    setHistoryLoading(true)
    const r = await getStockTransactions({ product_id: product.id })
    setHistoryData(r.data)
    setHistoryLoading(false)
  }

  const totalValue = stock.reduce((s, p) => s + (p.total_stock || 0) * (p.purchase_price || 0), 0)
  const outOfStock = stock.filter(p => (p.total_stock || 0) <= 0).length
  const lowStock = stock.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= (p.min_stock_level || 5)).length

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📦 Stock Overview</h1>
          <p>Current inventory levels — {total} products · Stock auto-updates from sales & purchases</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="stat-chip"><span className="stat-chip-value">₹{(totalValue/1000).toFixed(1)}K</span><span className="stat-chip-label">Stock Value</span></div>
          {outOfStock > 0 && <div className="stat-chip" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}><span className="stat-chip-value" style={{ color: 'var(--danger)' }}>{outOfStock}</span><span className="stat-chip-label">Out of Stock</span></div>}
          {lowStock > 0 && <div className="stat-chip" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}><span className="stat-chip-value" style={{ color: 'var(--warning)' }}>{lowStock}</span><span className="stat-chip-label">Low Stock</span></div>}
        </div>
      </div>

      {/* How stock updates info bar */}
      <div style={{ padding: '10px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <span>📋 Stock changes automatically when:</span>
        <span>🧾 Sale created <strong style={{color:'var(--danger)'}}>decreases</strong> stock</span>
        <span>📦 Purchase received <strong style={{color:'var(--success)'}}>increases</strong> stock</span>
        <span>↩️ Sale cancelled/returned <strong style={{color:'var(--success)'}}>restores</strong> stock</span>
        <span>⚖️ Manual adjustments applied immediately</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-control" placeholder="🔍 Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ flex: 1 }} />
        <select className="form-control" value={catId} onChange={e => { setCatId(e.target.value); setPage(1) }} style={{ width: 200 }}>
          <option value="">All Categories</option>
          {catTree.parents.map(parent => {
            const subs = catTree.children[parent.id] || []
            return subs.length > 0 ? (
              <optgroup key={parent.id} label={`📁 ${parent.name}`}>
                <option value={parent.id}>{parent.name} (All)</option>
                {subs.map(s => <option key={s.id} value={s.id}>&nbsp;&nbsp;└ {s.name}</option>)}
              </optgroup>
            ) : (
              <option key={parent.id} value={parent.id}>📁 {parent.name}</option>
            )
          })}
          {catTree.all?.filter(c => c.parent_id && !catTree.parents.find(p => p.id === c.parent_id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : stock.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">📦</div><h3>No stock records</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr>
                  <th>Code</th><th>Product</th><th>Category</th>
                  <th style={{ textAlign: 'right' }}>Min Level</th>
                  <th style={{ textAlign: 'right' }}>Current Stock</th>
                  <th style={{ textAlign: 'right' }}>Purchase ₹</th>
                  <th style={{ textAlign: 'right' }}>Sell ₹</th>
                  <th style={{ textAlign: 'right' }}>Stock Value</th>
                  <th>Status</th>
                  <th></th>
                </tr></thead>
                <tbody>{stock.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.product_code}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td style={{ fontSize: 12 }}>{p.category_name || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{p.min_stock_level || 5}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 16,
                      color: (p.total_stock || 0) <= 0 ? 'var(--danger)' : (p.total_stock || 0) <= (p.min_stock_level || 5) ? 'var(--warning)' : 'var(--success)' }}>
                      {p.total_stock || 0}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>₹{(p.purchase_price || 0).toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>₹{(p.selling_price || 0).toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>₹{((p.total_stock || 0) * (p.purchase_price || 0)).toLocaleString('en-IN')}</td>
                    <td>
                      {(p.total_stock || 0) <= 0
                        ? <span className="badge badge-danger">Out of Stock</span>
                        : (p.total_stock || 0) <= (p.min_stock_level || 5)
                          ? <span className="badge badge-warning">Low Stock</span>
                          : <span className="badge badge-success">In Stock</span>}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openHistory(p)}
                        title="View stock movement history"
                      >📋 History</button>
                    </td>
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

      {/* Stock History Modal */}
      {historyModal && (
        <div className="modal-overlay" onClick={() => { setHistoryModal(null); setHistoryData([]) }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">📋 Stock History — {historyModal.name}</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Current stock: <strong style={{ color: (historyModal.total_stock || 0) > 0 ? 'var(--success)' : 'var(--danger)', fontSize: 15 }}>{historyModal.total_stock || 0}</strong> units
                </div>
              </div>
              <button className="modal-close" onClick={() => { setHistoryModal(null); setHistoryData([]) }}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: 0 }}>
              {historyLoading
                ? <div style={{ padding: 40, textAlign: 'center' }}><span className="loading-spinner" /></div>
                : historyData.length === 0
                  ? <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No history yet</h3><p>Stock movements will appear here as sales and purchases are made</p></div>
                  : <table className="table">
                    <thead><tr>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Change</th>
                      <th style={{ textAlign: 'right' }}>Before</th>
                      <th style={{ textAlign: 'right' }}>After</th>
                      <th>Notes</th>
                    </tr></thead>
                    <tbody>
                      {historyData.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {t.created_at?.split('T')[0]}
                            <div style={{ fontSize: 10, marginTop: 2 }}>{t.created_at?.split('T')[1]?.substring(0, 8)}</div>
                          </td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{TXN_ICON[t.transaction_type] || '📝'}</span>
                              <span className="badge badge-muted" style={{ color: TXN_COLOR[t.transaction_type] || 'var(--text-muted)' }}>
                                {t.transaction_type}
                              </span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15,
                            color: t.quantity_change > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {t.quantity_change > 0 ? '+' : ''}{t.quantity_change}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{t.quantity_before}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{t.quantity_after}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>{t.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
