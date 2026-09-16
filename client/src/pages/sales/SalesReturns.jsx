import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function SalesReturns() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [origInvoice, setOrigInvoice] = useState('')
  const [origSale, setOrigSale] = useState(null)
  const [returnItems, setReturnItems] = useState([])
  const [reason, setReason] = useState('')
  const [refundMode, setRefundMode] = useState('cash')

  useEffect(() => { load() }, [])
  async function load() {
    const r = await api.get('/sales/returns/list')
    setReturns(r.data.data)
    setLoading(false)
  }
  async function searchInvoice() {
    try {
      const r = await api.get('/sales', { params: { search: origInvoice } })
      const sale = r.data.data[0]
      if (!sale) return toast.error('Invoice not found')
      const det = await api.get(`/sales/${sale.id}`)
      setOrigSale(det.data)
      setReturnItems(det.data.items.map(i => ({ ...i, return_qty: 0, returning: false })))
    } catch { toast.error('Invoice not found') }
  }
  async function submitReturn() {
    const items = returnItems.filter(i => i.returning && i.return_qty > 0).map(i => ({
      sale_item_id: i.id, product_id: i.product_id, variant_id: i.variant_id,
      product_name: i.product_name, quantity: i.return_qty, unit_price: i.unit_price,
    }))
    if (!items.length) return toast.error('Select items to return')
    try {
      await api.post('/sales/returns', { original_sale_id: origSale.id, items, return_reason: reason, refund_mode: refundMode })
      toast.success('Return processed')
      setShowForm(false); setOrigSale(null); setReturnItems([]); setOrigInvoice('')
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>↩️ Sales Returns</h1><p>Process customer returns and exchanges</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>➕ New Return</button>
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : returns.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">↩️</div><h3>No returns yet</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Return #</th><th>Date</th><th>Original Invoice</th><th>Reason</th><th style={{ textAlign: 'right' }}>Amount</th><th>Refund</th></tr></thead>
                <tbody>{returns.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{r.return_number}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.return_date}</td>
                    <td>{r.original_sale_id ? `#${r.original_sale_id}` : '—'}</td>
                    <td>{r.return_reason || '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger-light)', fontWeight: 700 }}>{fmt(r.total_return_amount)}</td>
                    <td><span className="badge badge-info">{(r.refund_mode || '').toUpperCase()}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">↩️ Process Return</span><button className="modal-close" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Original Invoice Number</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-control" placeholder="INV-00001" value={origInvoice} onChange={e => setOrigInvoice(e.target.value)} />
                  <button className="btn btn-primary" onClick={searchInvoice}>Search</button>
                </div>
              </div>
              {origSale && (<>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13 }}>
                  <strong>{origSale.invoice_number}</strong> · {origSale.customer_name} · {fmt(origSale.total_amount)}
                </div>
                <table className="table"><thead><tr><th>Product</th><th style={{ textAlign: 'center' }}>Sold</th><th style={{ textAlign: 'center' }}>Return</th><th style={{ textAlign: 'center' }}>Select</th></tr></thead>
                  <tbody>{returnItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.product_name}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" min="0" max={item.quantity} value={item.return_qty}
                          onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, return_qty: Number(e.target.value) } : it))}
                          style={{ width: 60, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'center' }} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={item.returning}
                          onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, returning: e.target.checked } : it))} />
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                <div className="form-row" style={{ marginTop: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Return Reason</label>
                    <input className="form-control" value={reason} onChange={e => setReason(e.target.value)} placeholder="Defective, wrong size..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Refund Mode</label>
                    <select className="form-control" value={refundMode} onChange={e => setRefundMode(e.target.value)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="exchange">Exchange</option><option value="credit">Credit Note</option>
                    </select>
                  </div>
                </div>
              </>)}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              {origSale && <button className="btn btn-success" onClick={submitReturn}>✅ Process Return</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
