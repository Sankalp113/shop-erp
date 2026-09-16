import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('this_month')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [vendors, setVendors] = useState([])
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'cash', payment_date: new Date().toISOString().split('T')[0] })

  useEffect(() => { api.get('/vendors', { params: { limit: 200 } }).then(r => setVendors(r.data.data)) }, [])
  useEffect(() => { load() }, [period, from, to, vendorId, page])

  async function load() {
    setLoading(true)
    const params = { page, limit: 50, vendor_id: vendorId }
    if (period !== 'custom') params.period = period
    else { params.from = from; params.to = to }
    const r = await api.get('/purchases', { params })
    setPurchases(r.data.data); setTotal(r.data.total); setLoading(false)
  }

  async function loadDetail(id) {
    const r = await api.get(`/purchases/${id}`)
    setDetail(r.data)
  }

  async function makePayment() {
    try {
      await api.post(`/purchases/${payModal.id}/payment`, payForm)
      toast.success('Payment recorded')
      setPayModal(null); load()
      if (detail?.id === payModal.id) loadDetail(payModal.id)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const statusBadge = s => ({ paid: 'badge-success', partial: 'badge-warning', pending: 'badge-danger' }[s] || 'badge-muted')

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>📋 Purchase History</h1><p>All purchase orders and payments</p></div>
        <a href="/purchases/new" className="btn btn-primary">➕ New Purchase</a>
      </div>

      <div className="date-filter">
        {['today','this_week','this_month','last_month','custom'].map(p => (
          <button key={p} className={`date-filter-btn ${period===p?'active':''}`} onClick={() => { setPeriod(p); setPage(1) }}>
            {p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
        {period === 'custom' && (<>
          <input type="date" className="form-control" style={{width:'auto'}} value={from} onChange={e=>setFrom(e.target.value)}/>
          <input type="date" className="form-control" style={{width:'auto'}} value={to} onChange={e=>setTo(e.target.value)}/>
        </>)}
        <select className="form-control" value={vendorId} onChange={e=>{setVendorId(e.target.value);setPage(1)}} style={{width:180,marginLeft:'auto'}}>
          <option value="">All Vendors</option>
          {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : purchases.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">🚚</div><h3>No purchases found</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Purchase #</th><th>Date</th><th>Vendor</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>Paid</th><th style={{textAlign:'right'}}>Outstanding</th><th>Status</th><th></th></tr></thead>
                <tbody>{purchases.map(p=>(
                  <tr key={p.id}>
                    <td><span className="table-link" onClick={()=>loadDetail(p.id)}>{p.purchase_number}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.purchase_date}</td>
                    <td>{p.vendor_name||<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(p.total_amount)}</td>
                    <td style={{textAlign:'right',color:'var(--success)'}}>{fmt(p.paid_amount)}</td>
                    <td style={{textAlign:'right',color:p.outstanding_amount>0?'var(--danger)':'var(--text-muted)',fontWeight:p.outstanding_amount>0?700:400}}>{fmt(p.outstanding_amount)}</td>
                    <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm btn-ghost" onClick={()=>loadDetail(p.id)}>👁</button>
                      {p.outstanding_amount>0 && <button className="btn btn-sm btn-warning" onClick={()=>{ setPayModal(p); setPayForm({amount:p.outstanding_amount.toFixed(2),payment_mode:'cash',payment_date:new Date().toISOString().split('T')[0]}) }}>💳 Pay</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={()=>setDetail(null)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div><div className="modal-title">🚚 {detail.purchase_number}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{detail.purchase_date} · {detail.vendor_name||'Unknown vendor'}</div></div>
              <button className="modal-close" onClick={()=>setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="table">
                <thead><tr><th>Product</th><th style={{textAlign:'center'}}>Qty</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
                <tbody>{detail.items?.map((it,i)=><tr key={i}><td>{it.product_name}</td><td style={{textAlign:'center'}}>{it.quantity}</td><td style={{textAlign:'right'}}>{fmt(it.unit_price)}</td><td style={{textAlign:'right',fontWeight:700}}>{fmt(it.total_price)}</td></tr>)}</tbody>
              </table>
              <div className="divider"/>
              <div className="grid-2" style={{fontSize:13}}>
                <div>
                  <div>Total: <strong>{fmt(detail.total_amount)}</strong></div>
                  <div style={{color:'var(--success)'}}>Paid: <strong>{fmt(detail.paid_amount)}</strong></div>
                  {detail.outstanding_amount>0 && <div style={{color:'var(--danger)',fontWeight:700}}>Outstanding: {fmt(detail.outstanding_amount)}</div>}
                </div>
                <div>
                  {detail.payments?.map((pay,i)=><div key={i} style={{fontSize:12,color:'var(--text-muted)'}}>Payment {i+1}: {fmt(pay.amount)} · {pay.payment_date}</div>)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {detail.outstanding_amount>0 && <button className="btn btn-warning" onClick={()=>{setPayModal(detail);setPayForm({amount:detail.outstanding_amount.toFixed(2),payment_mode:'cash',payment_date:new Date().toISOString().split('T')[0]})}}>💳 Record Payment</button>}
              <button className="btn btn-secondary" onClick={()=>setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="modal-overlay" onClick={()=>setPayModal(null)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💳 Record Payment</span><button className="modal-close" onClick={()=>setPayModal(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Outstanding: <strong style={{color:'var(--danger)'}}>{fmt(payModal.outstanding_amount)}</strong></p>
              <div className="form-group"><label className="form-label">Amount *</label>
                <input type="number" className="form-control" value={payForm.amount} max={payModal.outstanding_amount} onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Payment Mode</label>
                <select className="form-control" value={payForm.payment_mode} onChange={e=>setPayForm(p=>({...p,payment_mode:e.target.value}))}>
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option>
                </select></div>
              <div className="form-group"><label className="form-label">Payment Date</label>
                <input type="date" className="form-control" value={payForm.payment_date} onChange={e=>setPayForm(p=>({...p,payment_date:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPayModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={makePayment}>✅ Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
