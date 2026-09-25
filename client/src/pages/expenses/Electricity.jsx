import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getElectricityBills, addElectricityBill, payElectricityBillByMode, deleteElectricityBill, updateElectricityBill } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const BLANK = { consumer_number:'',meter_number:'',bill_date:new Date().toISOString().split('T')[0],billing_period_start:'',billing_period_end:'',previous_reading:0,current_reading:0,units_consumed:0,bill_amount:'',due_date:'',notes:'' }

export default function Electricity() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [])
  async function load() { const b = await getElectricityBills(); setBills(b); setLoading(false) }

  const set = (k,v) => setForm(p => ({ ...p, [k]:v, ...(k==='previous_reading'||k==='current_reading' ? { units_consumed: k==='current_reading' ? Math.max(0,v - p.previous_reading) : Math.max(0, p.current_reading - v) } : {}) }))

  function openAdd() { setEditItem(null); setForm(BLANK); setShowForm(true) }
  function openEdit(b) {
    setEditItem(b)
    setForm({ consumer_number:b.consumer_number||'', meter_number:b.meter_number||'', bill_date:b.bill_date||'', billing_period_start:b.billing_period_start||'', billing_period_end:b.billing_period_end||'', previous_reading:b.previous_reading||0, current_reading:b.current_reading||0, units_consumed:b.units_consumed||0, bill_amount:b.bill_amount||'', due_date:b.due_date||'', notes:b.notes||'' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setForm(BLANK) }

  async function submit(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await updateElectricityBill(editItem.id, form)
        toast.success('Bill updated')
      } else {
        await addElectricityBill(form, user?.uid)
        toast.success('Bill added')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  async function pay(id, mode) {
    try { await payElectricityBillByMode(id, mode, user?.uid); toast.success('Bill marked as paid'); setPayModal(null); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>⚡ Electricity Bills</h1><p>Track and pay electricity bills</p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Bill</button>
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
                    <td><div style={{display:'flex',gap:4}}>
                      {b.status==='pending' && <button className="btn btn-sm btn-success" onClick={()=>setPayModal(b)}>💳 Pay</button>}
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(b)}>✏️</button>
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={async()=>{if(!window.confirm('Delete this bill?'))return;try{await deleteElectricityBill(b.id);toast.success('Deleted');load()}catch(e){toast.error(e.message)}}}>🗑️</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">⚡ {editItem?'Edit':'Add'} Electricity Bill</span><button className="modal-close" onClick={closeForm}>✕</button></div>
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
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem?'💾 Update':'✅ Add'} Bill</button>
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
