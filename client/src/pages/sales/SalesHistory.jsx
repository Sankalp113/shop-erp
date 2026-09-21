import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getSales, getSale, cancelSale as dbCancelSale, deleteSale } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const PERIODS = ['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'custom']

export default function SalesHistory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [detail, setDetail] = useState(null)

  useEffect(() => { load() }, [period, from, to, search, page])

  function getDateRange() {
    const d = new Date(), f = d => d.toISOString().split('T')[0]
    if (period === 'today') return { from: f(d), to: f(d) }
    if (period === 'yesterday') { const y = new Date(d - 86400000); return { from: f(y), to: f(y) } }
    if (period === 'this_week') { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return { from: f(s), to: f(d) } }
    if (period === 'this_month') return { from: f(d).slice(0,7) + '-01', to: f(d) }
    if (period === 'last_month') { const lm = new Date(d.getFullYear(), d.getMonth()-1, 1); const le = new Date(d.getFullYear(), d.getMonth(), 0); return { from: f(lm), to: f(le) } }
    if (period === 'custom') return { from, to }
    return {}
  }

  async function load() {
    setLoading(true)
    try {
      const range = getDateRange()
      const r = await getSales({ ...range, search, limit: 50 })
      setSales(r.data)
      setTotals(r.totals || {})
      setTotalCount(r.total)
    } finally { setLoading(false) }
  }

  async function loadDetail(id) {
    const sale = await getSale(id)
    setDetail(sale)
  }

  async function cancelSale(id) {
    if (!confirm('Cancel this sale? Stock will be restored.')) return
    try {
      await dbCancelSale(id, user?.uid, user?.username)
      toast.success('Sale cancelled')
      load()
      setDetail(null)
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const statusBadge = (s) => {
    if (s === 'completed') return <span className="badge badge-success">Completed</span>
    if (s === 'cancelled') return <span className="badge badge-danger">Cancelled</span>
    if (s === 'returned') return <span className="badge badge-warning">Returned</span>
    return <span className="badge badge-muted">{s}</span>
  }

  const payBadge = (m) => {
    const map = { cash: 'badge-success', upi: 'badge-info', card: 'badge-primary', credit: 'badge-warning', split: 'badge-muted' }
    return <span className={`badge ${map[m] || 'badge-muted'}`}>{(m || '').toUpperCase()}</span>
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><h1>📋 Sales History</h1><p>All bills and invoices</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>➕ New Sale</button>
      </div>

      {/* Summary chips */}
      <div className="stats-row">
        {[
          { label: 'Total Sales', val: fmt(totals.total_sales) },
          { label: 'Bills', val: totalCount },
          { label: 'Cash', val: fmt(totals.cash) },
          { label: 'UPI', val: fmt(totals.upi) },
          { label: 'Card', val: fmt(totals.card) },
          { label: 'Credit', val: fmt(totals.credit) },
        ].map(s => (
          <div key={s.label} className="stat-chip">
            <span className="stat-chip-value">{s.val}</span>
            <span className="stat-chip-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="date-filter">
        {PERIODS.map(p => (
          <button key={p} className={`date-filter-btn ${period === p ? 'active' : ''}`} onClick={() => { setPeriod(p); setPage(1) }}>
            {p.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" className="form-control" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
            <input type="date" className="form-control" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
          </>
        )}
        <input className="form-control" placeholder="Search invoice / customer..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ marginLeft: 'auto', maxWidth: 240 }} />
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /><span>Loading...</span></div>
            : sales.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No sales found</h3></div>
              : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th>
                        <th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map(s => (
                        <tr key={s.id}>
                          <td><span className="table-link" onClick={() => loadDetail(s.id)}>{s.invoice_number}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.sale_date}</td>
                          <td>{s.customer_name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</td>
                          <td>{payBadge(s.payment_mode)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(s.total_amount)}</td>
                          <td>{statusBadge(s.status)}</td>
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              <button className="btn btn-sm btn-ghost" onClick={() => loadDetail(s.id)}>👁 View</button>
                              <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={async()=>{if(!window.confirm(`Delete invoice ${s.invoice_number}? Stock will be restored.`))return;try{await deleteSale(s.id);toast.success('Sale deleted');load()}catch(e){toast.error(e.message)}}}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>
      </div>

      {/* Pagination */}
      {totalCount > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{page} / {Math.ceil(totalCount / 50)}</span>
          <button className="btn btn-secondary btn-sm" disabled={page * 50 >= totalCount} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">🧾 {detail.invoice_number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail.sale_date} · {detail.customer_name || 'Walk-in Customer'}</div>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="table">
                <thead><tr><th>Product</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Disc%</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {detail.items?.map((item, i) => (
                    <tr key={i}>
                      <td>{item.product_name}{item.size && ` / ${item.size}`}{item.color && ` / ${item.color}`}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                      <td style={{ textAlign: 'right' }}>{item.discount_percent}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divider" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Subtotal: <strong>{fmt(detail.subtotal)}</strong></div>
                  <div style={{ color: 'var(--text-muted)' }}>Discount: <strong style={{ color: 'var(--warning)' }}>-{fmt(detail.discount_amount)}</strong></div>
                  <div style={{ color: 'var(--text-muted)' }}>Tax: <strong>{fmt(detail.tax_amount)}</strong></div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Total: {fmt(detail.total_amount)}</div>
                </div>
                <div>
                  {detail.cash_amount > 0 && <div style={{ color: 'var(--text-muted)' }}>Cash: <strong>{fmt(detail.cash_amount)}</strong></div>}
                  {detail.upi_amount > 0 && <div style={{ color: 'var(--text-muted)' }}>UPI: <strong>{fmt(detail.upi_amount)}</strong></div>}
                  {detail.card_amount > 0 && <div style={{ color: 'var(--text-muted)' }}>Card: <strong>{fmt(detail.card_amount)}</strong></div>}
                  {detail.credit_amount > 0 && <div style={{ color: 'var(--warning)' }}>Credit: <strong>{fmt(detail.credit_amount)}</strong></div>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {detail.status === 'completed' && (
                <button className="btn btn-danger btn-sm" onClick={() => cancelSale(detail.id)}>🚫 Cancel Sale</button>
              )}
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
