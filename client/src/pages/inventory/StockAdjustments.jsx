import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getProducts, getStockAdjustments, createStockAdjustment } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const TYPES = ['damaged', 'missing', 'physical_count', 'expired', 'sample', 'internal_use', 'correction']

export default function StockAdjustments() {
  const { user } = useAuth()
  const [adjustments, setAdjustments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ product_id: '', adjustment_type: 'damaged', quantity_change: '', reason: '', notes: '' })

  useEffect(() => {
    load()
    getProducts({ limit: 200 }).then(r => setProducts(r.data))
  }, [])

  async function load() {
    const r = await getStockAdjustments()
    setAdjustments(r.data); setLoading(false)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.product_id || !form.quantity_change || !form.reason) return toast.error('Fill all required fields')
    const selProduct = products.find(p => p.id === form.product_id)
    try {
      await createStockAdjustment({ ...form, quantity_change: Number(form.quantity_change), product_name: selProduct?.name }, user?.uid)
      toast.success('Stock adjustment recorded')
      setShowForm(false); setForm({ product_id: '', adjustment_type: 'damaged', quantity_change: '', reason: '', notes: '' }); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>⚖️ Stock Adjustments</h1><p>Record damaged, missing, or corrected stock</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>➕ New Adjustment</button>
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : adjustments.length === 0 ? <div className="empty-state"><div className="empty-state-icon">⚖️</div><h3>No adjustments yet</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th style={{ textAlign: 'right' }}>Change</th><th style={{ textAlign: 'right' }}>Before</th><th style={{ textAlign: 'right' }}>After</th><th>Reason</th></tr></thead>
                <tbody>{adjustments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.created_at?.split('T')[0]}</td>
                    <td style={{ fontWeight: 600 }}>{a.product_name}{a.size_name && ` / ${a.size_name}`}{a.color_name && ` / ${a.color_name}`}</td>
                    <td><span className="badge badge-muted">{a.adjustment_type.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: a.quantity_change > 0 ? 'var(--success)' : 'var(--danger)' }}>{a.quantity_change > 0 ? '+' : ''}{a.quantity_change}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{a.quantity_before}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{a.quantity_after}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.reason}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">⚖️ Stock Adjustment</span><button className="modal-close" onClick={() => setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Product *</label>
                  <select className="form-control" value={form.product_id} onChange={e => set('product_id', e.target.value)} required>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.total_stock})</option>)}
                  </select></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Adjustment Type *</label>
                    <select className="form-control" value={form.adjustment_type} onChange={e => set('adjustment_type', e.target.value)}>
                      {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Quantity Change *</label>
                    <input type="number" className="form-control" value={form.quantity_change} onChange={e => set('quantity_change', e.target.value)} placeholder="-5 or +3" required />
                    <div className="form-hint">Use negative for reduction, positive for addition</div>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Reason *</label>
                  <input className="form-control" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Describe reason for adjustment" required />
                </div>
                <div className="form-group"><label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Save Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
