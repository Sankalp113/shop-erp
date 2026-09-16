import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function Rent() {
  const [rents, setRents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rent_type:'monthly', period_start:'', period_end:'', amount:'', due_date:'', landlord_name:'', notes:'' })

  useEffect(() => { load() }, [])
  async function load() { const r = await api.get('/expenses/rent'); setRents(r.data); setLoading(false) }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function submit(e) {
    e.preventDefault()
    try { await api.post('/expenses/rent', form); toast.success('Rent record added'); setShowForm(false); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  async function pay(id, mode='cash') {
    try { await api.post(`/expenses/rent/${id}/pay`, { payment_mode: mode }); toast.success('Rent marked as paid'); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const pending = rents.filter(r=>r.status==='pending')
  const totalPending = pending.reduce((s,r)=>s+r.amount,0)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🏠 Shop Rent</h1><p>Track monthly rent payments</p></div>
        <div style={{display:'flex',gap:8}}>
          {totalPending > 0 && <div className="stat-chip" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)'}}><span style={{fontWeight:700,color:'var(--warning)'}}>{fmt(totalPending)}</span><span className="stat-chip-label">Pending</span></div>}
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}>➕ Add Rent</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : rents.length===0
              ? <div className="empty-state"><div className="empty-state-icon">🏠</div><h3>No rent records</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Type</th><th>Period</th><th>Landlord</th><th>Due Date</th><th style={{textAlign:'right'}}>Amount</th><th>Status</th><th>Paid On</th><th></th></tr></thead>
                <tbody>{rents.map(r=>(
                  <tr key={r.id}>
                    <td><span className="badge badge-info">{r.rent_type}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.period_start} {r.period_end?`→ ${r.period_end}`:''}</td>
                    <td style={{fontSize:12}}>{r.landlord_name||'—'}</td>
                    <td style={{fontSize:12,color:new Date(r.due_date)<new Date()&&r.status==='pending'?'var(--danger)':'var(--text-muted)'}}>{r.due_date}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(r.amount)}</td>
                    <td><span className={`badge ${r.status==='paid'?'badge-success':'badge-danger'}`}>{r.status}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.payment_date||'—'}</td>
                    <td>{r.status==='pending' && (
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm btn-success" onClick={()=>pay(r.id,'cash')}>Cash</button>
                        <button className="btn btn-sm btn-secondary" onClick={()=>pay(r.id,'upi')}>UPI</button>
                      </div>
                    )}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🏠 Add Rent Record</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Rent Type</label>
                    <select className="form-control" value={form.rent_type} onChange={e=>set('rent_type',e.target.value)}>
                      <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                    </select></div>
                  <div className="form-group"><label className="form-label">Amount *</label><input type="number" className="form-control" value={form.amount} onChange={e=>set('amount',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Due Date *</label><input type="date" className="form-control" value={form.due_date} onChange={e=>set('due_date',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Landlord Name</label><input className="form-control" value={form.landlord_name} onChange={e=>set('landlord_name',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Period Start</label><input type="date" className="form-control" value={form.period_start} onChange={e=>set('period_start',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Period End</label><input type="date" className="form-control" value={form.period_end} onChange={e=>set('period_end',e.target.value)}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Add Rent</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
