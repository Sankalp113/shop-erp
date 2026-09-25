import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getProducts, getStockAdjustments, createStockAdjustment, deleteStockAdjustment } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { useRefresh } from '../../context/RefreshContext'


const TYPES = ['damaged', 'missing', 'physical_count', 'expired', 'sample', 'internal_use', 'correction', 'received', 'returned']
const BLANK = { product_id: '', adjustment_type: 'physical_count', quantity_change: '', reason: '', notes: '', adjustment_date: new Date().toISOString().split('T')[0] }

const typeColor = t => ({
  damaged: 'badge-danger', missing: 'badge-danger', expired: 'badge-danger',
  received: 'badge-success', returned: 'badge-success',
  physical_count: 'badge-info', correction: 'badge-info',
  sample: 'badge-warning', internal_use: 'badge-warning'
}[t] || 'badge-muted')

export default function StockAdjustments() {
  const { user } = useAuth()
  const { refresh } = useRefresh()

  const [adjustments, setAdjustments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(BLANK)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    load()
    getProducts({ limit: 500 }).then(r => setProducts(r.data))
  }, [])

  useEffect(() => { load() }, [fromDate, toDate])

  async function load() {
    setLoading(true)
    const r = await getStockAdjustments({ from: fromDate || undefined, to: toDate || undefined })
    setAdjustments(r.data); setLoading(false)
  }

  const set = (k, v) => {
    setForm(p => {
      const next = { ...p, [k]: v }
      // Live preview of new stock
      if (k === 'product_id' || k === 'quantity_change') {
        const prod = products.find(pr => pr.id === (k === 'product_id' ? v : p.product_id))
        if (prod) {
          const qty = Number(k === 'quantity_change' ? v : p.quantity_change) || 0
          setPreview({ before: prod.total_stock, after: prod.total_stock + qty, name: prod.name })
        } else { setPreview(null) }
      }
      return next
    })
  }

  function openForm() { setForm(BLANK); setPreview(null); setShowForm(true) }
  function closeForm() { setShowForm(false); setForm(BLANK); setPreview(null) }

  async function submit(e) {
    e.preventDefault()
    if (!form.product_id || !form.quantity_change || !form.reason) return toast.error('Fill all required fields')
    const selProduct = products.find(p => p.id === form.product_id)
    try {
      await createStockAdjustment({
        ...form,
        quantity_change: Number(form.quantity_change),
        product_name: selProduct?.name
      }, user?.uid)
      toast.success('Stock adjustment recorded — stock updated')
      refresh('stock', 'products')
      closeForm(); load()

    } catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete this adjustment? Stock will be REVERSED:\n${a.product_name}: ${a.quantity_change > 0 ? '+' : ''}${a.quantity_change} will be undone.`)) return
    try {
      await deleteStockAdjustment(a.id)
      toast.success('Adjustment deleted and stock reversed')
      refresh('stock', 'products')
      load()

    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const totalAdded = adjustments.filter(a => a.quantity_change > 0).reduce((s, a) => s + a.quantity_change, 0)
  const totalRemoved = adjustments.filter(a => a.quantity_change < 0).reduce((s, a) => s + Math.abs(a.quantity_change), 0)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>⚖️ Stock Adjustments</h1>
          <p>Manual stock corrections — all changes update product stock in real-time</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="stat-chip"><span className="stat-chip-value" style={{ color: 'var(--success)' }}>+{totalAdded}</span><span className="stat-chip-label">Added</span></div>
          <div className="stat-chip"><span className="stat-chip-value" style={{ color: 'var(--danger)' }}>-{totalRemoved}</span><span className="stat-chip-label">Removed</span></div>
          <button className="btn btn-primary" onClick={openForm}>➕ New Adjustment</button>
        </div>
      </div>

      {/* Date filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Filter by date:</label>
        <input type="date" className="form-control" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: 'auto' }} placeholder="From" />
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <input type="date" className="form-control" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: 'auto' }} placeholder="To" />
        {(fromDate || toDate) && <button className="btn btn-secondary btn-sm" onClick={() => { setFromDate(''); setToDate('') }}>✕ Clear</button>}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : adjustments.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">⚖️</div>
                  <h3>No adjustments yet</h3>
                  <p>Record damaged goods, physical count corrections, received stock, etc.</p>
                  <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openForm}>➕ New Adjustment</button>
                </div>
              : <div className="table-container"><table className="table">
                <thead><tr>
                  <th>Adj. Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                  <th style={{ textAlign: 'right' }}>Before</th>
                  <th style={{ textAlign: 'right' }}>After</th>
                  <th>Reason</th>
                  <th></th>
                </tr></thead>
                <tbody>{adjustments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{a.adjustment_date || a.created_at?.split('T')[0]}</strong>
                      <div style={{ fontSize: 10, marginTop: 2 }}>logged: {a.created_at?.split('T')[0]}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{a.product_name}</td>
                    <td><span className={`badge ${typeColor(a.adjustment_type)}`}>{a.adjustment_type.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: a.quantity_change > 0 ? 'var(--success)' : 'var(--danger)', fontSize: 15 }}>
                      {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{a.quantity_before}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{a.quantity_after}</td>
                    <td style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.reason}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        title="Delete & reverse stock change"
                        onClick={() => handleDelete(a)}
                      >🗑️</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {/* Add Adjustment Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⚖️ Stock Adjustment</span>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {/* Date field — REQUIRED */}
                <div className="form-group">
                  <label className="form-label">📅 Adjustment Date *</label>
                  <input type="date" className="form-control" value={form.adjustment_date} onChange={e => set('adjustment_date', e.target.value)} required />
                  <div className="form-hint">The actual date the stock change occurred</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={form.product_id} onChange={e => set('product_id', e.target.value)} required>
                    <option value="">Select product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.total_stock})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Adjustment Type *</label>
                    <select className="form-control" value={form.adjustment_type} onChange={e => set('adjustment_type', e.target.value)}>
                      <optgroup label="Stock Reduction">
                        {['damaged','missing','expired','sample','internal_use'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </optgroup>
                      <optgroup label="Stock Addition">
                        {['received','returned'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </optgroup>
                      <optgroup label="Correction">
                        {['physical_count','correction'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity Change *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.quantity_change}
                      onChange={e => set('quantity_change', e.target.value)}
                      placeholder="-5 to reduce, +3 to add"
                      required
                    />
                    <div className="form-hint">Negative = reduce stock · Positive = add stock</div>
                  </div>
                </div>

                {/* Live stock preview */}
                {preview && (
                  <div style={{ display: 'flex', gap: 16, padding: '12px 16px', background: 'rgba(124,58,237,0.08)', borderRadius: 8, marginBottom: 16, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>📦 {preview.name}</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>Before: <strong>{preview.before}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: preview.after >= 0 ? 'var(--success)' : 'var(--danger)' }}>After: {preview.after}</span>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <input className="form-control" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="e.g. Found 3 damaged pieces during inspection" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." rows={2} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Save & Update Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
