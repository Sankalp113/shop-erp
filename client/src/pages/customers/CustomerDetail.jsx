import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function CustomerDetail() {
  const { id } = useParams(); const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [ledger, setLedger] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ledger')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [payModal, setPayModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount:'', payment_mode:'cash', payment_date: new Date().toISOString().split('T')[0], notes:'' })

  useEffect(() => { load() }, [id])
  async function load() {
    const [c, l, s] = await Promise.all([
      api.get(`/customers/${id}`),
      api.get(`/customers/${id}/ledger`),
      api.get('/sales', { params: { customer_id: id, limit: 50 } }),
    ])
    setCustomer(c.data); setForm(c.data)
    setLedger(l.data); setSales(s.data.data)
    setLoading(false)
  }

  async function saveEdit() {
    try { await api.put(`/customers/${id}`, form); toast.success('Customer updated'); setEditing(false); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  async function recordPayment() {
    if (!payForm.amount) return toast.error('Enter amount')
    try {
      await api.post(`/customers/${id}/payment`, payForm)
      toast.success('Payment collected'); setPayModal(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  if (loading) return <div className="loading-overlay"><span className="loading-spinner"/></div>
  if (!customer) return <div className="empty-state"><h3>Customer not found</h3></div>

  const outstanding = customer.total_outstanding || 0

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/customers')} style={{marginBottom:8}}>← Back to Customers</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h1>👤 {customer.name}</h1>
            <p style={{color:'var(--text-muted)'}}>{customer.mobile||''} {customer.city?`· ${customer.city}`:''}</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            {outstanding > 0 && <button className="btn btn-warning" onClick={() => { setPayModal(true); setPayForm(p=>({...p, amount: outstanding.toFixed(2)})) }}>💳 Collect Payment</button>}
            <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : '✏️ Edit'}</button>
            {editing && <button className="btn btn-primary" onClick={saveEdit}>✅ Save</button>}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[
          { label:'Total Purchased', val: fmt(customer.total_purchased), color:'var(--primary-light)' },
          { label:'Total Paid', val: fmt((customer.total_purchased||0)-(outstanding)), color:'var(--success)' },
          { label:'Outstanding', val: fmt(outstanding), color: outstanding > 0 ? 'var(--warning)' : 'var(--success)' },
          { label:'Credit Limit', val: customer.credit_limit > 0 ? fmt(customer.credit_limit) : 'No Limit', color:'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body">
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">Edit Customer</span></div>
          <div className="card-body">
            <div className="form-row">
              {[['name','Name'],['mobile','Mobile'],['email','Email'],['city','City'],['address','Address']].map(([k,l]) => (
                <div key={k} className="form-group"><label className="form-label">{l}</label>
                  <input className="form-control" value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/></div>
              ))}
              <div className="form-group"><label className="form-label">Credit Limit (₹)</label>
                <input type="number" className="form-control" value={form.credit_limit||0} onChange={e=>setForm(p=>({...p,credit_limit:e.target.value}))}/></div>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        {[['ledger','📒 Ledger'],['sales','🛒 Sales']].map(([t,l]) => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {tab === 'ledger' && (
        <div className="card">
          <div className="card-body" style={{padding:0}}>
            {ledger.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">📒</div><h3>No transactions yet</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Date</th><th>Description</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Credit</th><th style={{textAlign:'right'}}>Balance</th></tr></thead>
                <tbody>{ledger.map((l,i) => (
                  <tr key={i}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.transaction_date}</td>
                    <td>{l.description}</td>
                    <td style={{textAlign:'right',color:'var(--danger)',fontWeight:l.debit_amount>0?700:400}}>{l.debit_amount>0?fmt(l.debit_amount):'—'}</td>
                    <td style={{textAlign:'right',color:'var(--success)',fontWeight:l.credit_amount>0?700:400}}>{l.credit_amount>0?fmt(l.credit_amount):'—'}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:l.balance>0?'var(--warning)':'var(--success)'}}>{fmt(l.balance)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            }
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="card">
          <div className="card-body" style={{padding:0}}>
            {sales.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">🛒</div><h3>No sales yet</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Invoice</th><th>Date</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>Credit</th><th style={{textAlign:'right'}}>Paid</th><th>Status</th></tr></thead>
                <tbody>{sales.map(s => (
                  <tr key={s.id}>
                    <td style={{fontWeight:600,color:'var(--primary-light)'}}>{s.invoice_number}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.sale_date}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(s.total_amount)}</td>
                    <td style={{textAlign:'right',color:s.credit_amount>0?'var(--warning)':'var(--text-muted)'}}>{fmt(s.credit_amount)}</td>
                    <td style={{textAlign:'right',color:'var(--success)'}}>{fmt(s.paid_amount)}</td>
                    <td><span className={`badge ${s.status==='completed'?'badge-success':'badge-muted'}`}>{s.status}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            }
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(false)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💳 Collect Payment from {customer.name}</span><button className="modal-close" onClick={() => setPayModal(false)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Outstanding: <strong style={{color:'var(--warning)'}}>{fmt(outstanding)}</strong></p>
              <div className="form-group"><label className="form-label">Amount *</label>
                <input type="number" className="form-control" value={payForm.amount} max={outstanding} onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Payment Mode</label>
                <select className="form-control" value={payForm.payment_mode} onChange={e=>setPayForm(p=>({...p,payment_mode:e.target.value}))}>
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
                </select></div>
              <div className="form-group"><label className="form-label">Date</label>
                <input type="date" className="form-control" value={payForm.payment_date} onChange={e=>setPayForm(p=>({...p,payment_date:e.target.value}))}/></div>
              <div className="form-group"><label className="form-label">Notes</label>
                <input className="form-control" value={payForm.notes} onChange={e=>setPayForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes"/></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={recordPayment}>✅ Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
