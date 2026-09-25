import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getRentRecords, addRentRecord, payRentByMode, deleteRentRecord, updateRentRecord } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const BLANK = { rent_type:'monthly', period_start:'', period_end:'', amount:'', due_date:'', landlord_name:'', notes:'' }

export default function Rent() {
  const { user } = useAuth()
  const [rents, setRents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [])
  async function load() { const recs = await getRentRecords(); setRents(recs); setLoading(false) }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  function openAdd() { setEditItem(null); setForm(BLANK); setShowForm(true) }
  function openEdit(r) {
    setEditItem(r)
    setForm({ rent_type:r.rent_type||'monthly', period_start:r.period_start||'', period_end:r.period_end||'', amount:r.amount||'', due_date:r.due_date||'', landlord_name:r.landlord_name||'', notes:r.notes||'' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setForm(BLANK) }

  async function submit(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await updateRentRecord(editItem.id, form)
        toast.success('Rent record updated')
      } else {
        await addRentRecord(form, user?.uid)
        toast.success('Rent record added')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  async function pay(id, mode='cash') {
    try { await payRentByMode(id, mode, user?.uid); toast.success('Rent marked as paid'); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  const pending = rents.filter(r=>r.status==='pending')
  const totalPending = pending.reduce((s,r)=>s+r.amount,0)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🏠 Shop Rent</h1><p>Track monthly rent payments</p></div>
        <div style={{display:'flex',gap:8}}>
          {totalPending > 0 && <div className="stat-chip" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)'}}><span style={{fontWeight:700,color:'var(--warning)'}}>{fmt(totalPending)}</span><span className="stat-chip-label">Pending</span></div>}
          <button className="btn btn-primary" onClick={openAdd}>➕ Add Rent</button>
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
                    <td><div style={{display:'flex',gap:4}}>
                      {r.status==='pending' && (<><button className="btn btn-sm btn-success" onClick={()=>pay(r.id,'cash')}>Cash</button><button className="btn btn-sm btn-secondary" onClick={()=>pay(r.id,'upi')}>UPI</button></>)}
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(r)}>✏️</button>
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={async()=>{if(!window.confirm('Delete this rent record?'))return;try{await deleteRentRecord(r.id);toast.success('Deleted');load()}catch(e){toast.error(e.message)}}}>🗑️</button>
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
            <div className="modal-header"><span className="modal-title">🏠 {editItem?'Edit':'Add'} Rent Record</span><button className="modal-close" onClick={closeForm}>✕</button></div>
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
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem?'💾 Update':'✅ Add'} Rent</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
