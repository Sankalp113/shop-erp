import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function Electricity() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const [form, setForm] = useState({ consumer_number:'',meter_number:'',bill_date:new Date().toISOString().split('T')[0],billing_period_start:'',billing_period_end:'',previous_reading:0,current_reading:0,units_consumed:0,bill_amount:'',due_date:'',notes:'' })

  useEffect(() => { load() }, [])
  async function load() { const r = await api.get('/expenses/electricity'); setBills(r.data); setLoading(false) }
  const set = (k,v) => setForm(p => ({ ...p, [k]:v, ...(k==='previous_reading'||k==='current_reading' ? { units_consumed: k==='current_reading' ? Math.max(0,v - p.previous_reading) : Math.max(0, p.current_reading - v) } : {}) }))

  async function submit(e) {
    e.preventDefault()
    try { await api.post('/expenses/electricity', form); toast.success('Bill added'); setShowForm(false); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  async function pay(id, mode) {
    try { await api.post(`/expenses/electricity/${id}/pay`, { payment_mode: mode }); toast.success('Bill marked as paid'); setPayModal(null); load() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>⚡ Electricity Bills</h1><p>Track and pay electricity bills</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>➕ Add Bill</button>
      </div>
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : bills.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">⚡</div><h3>No electricity bills</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Bill Date</th><th>Period</th><th>Units</th><th>Due Date</th><th style={{textAlign:'right'}}>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>{bills.map(b => (
                  <tr key={b.id}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{b.bill_date}</td>
                    <td style={{fontSize:12}}>{b.billing_period_start} to {b.billing_period_end}</td>
                    <td style={{fontWeight:600}}>{b.units_consumed}</td>
                    <td style={{fontSize:12,color: new Date(b.due_date) < new Date() && b.status==='pending' ? 'var(--danger)':'var(--text-muted)'}}>{b.due_date}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(b.bill_amount)}</td>
                    <td><span className={`badge ${b.status==='paid'?'badge-success':'badge-danger'}`}>{b.status}</span></td>
                    <td>{b.status==='pending' && <button className="btn btn-sm btn-success" onClick={()=>setPayModal(b)}>💳 Pay</button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">⚡ Add Electricity Bill</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  {[['consumer_number','Consumer Number'],['meter_number','Meter Number']].map(([k,l])=>(
                    <div key={k} className="form-group"><label className="form-label">{l}</label><input className="form-control" value={form[k]} onChange={e=>set(k,e.target.value)}/></div>
                  ))}
                  {[['bill_date','Bill Date','date'],['due_date','Due Date *','date'],['billing_period_start','Period Start','date'],['billing_period_end','Period End','date']].map(([k,l,t])=>(
                    <div key={k} className="form-group"><label className="form-label">{l}</label><input type={t||'text'} className="form-control" value={form[k]} onChange={e=>set(k,e.target.value)} required={k==='due_date'}/></div>
                  ))}
                  {[['previous_reading','Previous Reading'],['current_reading','Current Reading']].map(([k,l])=>(
                    <div key={k} className="form-group"><label className="form-label">{l}</label><input type="number" className="form-control" value={form[k]} onChange={e=>set(k,Number(e.target.value))}/></div>
                  ))}
                  <div className="form-group"><label className="form-label">Units Consumed</label><input type="number" className="form-control" value={form.units_consumed} readOnly style={{background:'rgba(255,255,255,0.03)'}}/></div>
                  <div className="form-group"><label className="form-label">Bill Amount *</label><input type="number" className="form-control" value={form.bill_amount} onChange={e=>set('bill_amount',e.target.value)} required/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Add Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={()=>setPayModal(null)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">⚡ Pay Electricity Bill</span><button className="modal-close" onClick={()=>setPayModal(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:15,fontWeight:700,marginBottom:8}}>Amount: {fmt(payModal.bill_amount)}</p>
              <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Due: {payModal.due_date}</p>
              <div style={{display:'flex',gap:8}}>
                {['cash','upi','bank'].map(m => (
                  <button key={m} className="btn btn-primary w-full" style={{justifyContent:'center'}} onClick={()=>pay(payModal.id, m)}>{m.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
