import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getEmployees, getSalaries, generateSalaries, paySalary, updateSalary, deleteSalaryRecord } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function Salary() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [salaries, setSalaries] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().substring(0,7))
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ bonus_amount:0, deduction_amount:0, notes:'' })

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { loadSalaries() }, [month])

  async function loadEmployees() { const emps = await getEmployees(); setEmployees(emps) }
  async function loadSalaries() {
    setLoading(true)
    const recs = await getSalaries({ month })
    setSalaries(recs); setLoading(false)
  }

  async function generate() {
    if (!confirm(`Generate salary records for ${month}?`)) return
    setGenerating(true)
    try {
      await generateSalaries(month, employees, user?.uid)
      toast.success('Salary records generated'); loadSalaries()
    } catch (err) { toast.error(err.message || 'Failed') } finally { setGenerating(false) }
  }

  async function markPaid(salary) {
    try {
      await paySalary(salary.id, { payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash' }, user?.uid)
      toast.success('Salary marked as paid'); loadSalaries(); setPayModal(null)
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  function openEdit(s) {
    setEditForm({ bonus_amount: s.bonus_amount||0, deduction_amount: s.deduction_amount||0, notes: s.notes||'' })
    setEditModal(s)
  }

  async function saveEdit(e) {
    e.preventDefault()
    try {
      const bonus = Number(editForm.bonus_amount)||0
      const ded = Number(editForm.deduction_amount)||0
      const net = (editModal.base_salary||0) + bonus - ded
      await updateSalary(editModal.id, { bonus_amount: bonus, deduction_amount: ded, net_salary: net, notes: editForm.notes })
      toast.success('Salary updated'); setEditModal(null); loadSalaries()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const totalNet = salaries.reduce((s,sl) => s+(sl.net_salary||0), 0)
  const totalPaid = salaries.filter(s=>s.status==='paid').reduce((s,sl) => s+(sl.net_salary||0), 0)
  const totalPending = salaries.filter(s=>s.status!=='paid').reduce((s,sl) => s+(sl.net_salary||0), 0)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>💰 Salary</h1><p>Manage employee salaries for selected month</p></div>
        <div style={{display:'flex',gap:8}}>
          <input type="month" className="form-control" value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto'}}/>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>{generating?'⏳ Generating...':'🔄 Generate Salaries'}</button>
        </div>
      </div>

      {salaries.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
          {[
            { label:'Total Payroll', val:fmt(totalNet), color:'var(--primary-light)' },
            { label:'Paid', val:fmt(totalPaid), color:'var(--success)' },
            { label:'Pending', val:fmt(totalPending), color:'var(--warning)' },
          ].map(s=>(
            <div key={s.label} className="card">
              <div className="card-body">
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
                <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : salaries.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">💰</div>
                  <h3>No salary records for {month}</h3>
                  <p>Click "Generate Salaries" to create records for all active employees</p>
                  <button className="btn btn-primary" style={{marginTop:16}} onClick={generate}>🔄 Generate</button>
                </div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Employee</th><th>Designation</th><th style={{textAlign:'right'}}>Base</th><th style={{textAlign:'right'}}>Bonus</th><th style={{textAlign:'right'}}>Deduction</th><th style={{textAlign:'right'}}>Net Salary</th><th>Status</th><th></th></tr></thead>
                <tbody>{salaries.map(s=>(
                  <tr key={s.id}>
                    <td style={{fontWeight:600}}>{s.employee_name}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.designation||'—'}</td>
                    <td style={{textAlign:'right'}}>{fmt(s.base_salary)}</td>
                    <td style={{textAlign:'right',color:'var(--success)'}}>{s.bonus_amount>0?fmt(s.bonus_amount):'—'}</td>
                    <td style={{textAlign:'right',color:'var(--danger)'}}>{s.deduction_amount>0?fmt(s.deduction_amount):'—'}</td>
                    <td style={{textAlign:'right',fontWeight:800,fontSize:15}}>{fmt(s.net_salary)}</td>
                    <td><span className={`badge ${s.status==='paid'?'badge-success':s.status==='partial'?'badge-warning':'badge-danger'}`}>{s.status}</span></td>
                    <td><div style={{display:'flex',gap:4}}>
                      {s.status!=='paid' && <button className="btn btn-sm btn-success" onClick={()=>setPayModal(s)}>💳 Pay</button>}
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(s)}>✏️</button>
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={async()=>{if(!window.confirm(`Delete salary record for ${s.employee_name}?`))return;try{await deleteSalaryRecord(s.id);toast.success('Deleted');loadSalaries()}catch(e){toast.error(e.message)}}}>🗑️</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {payModal && (
        <div className="modal-overlay" onClick={()=>setPayModal(null)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💳 Pay Salary — {payModal.employee_name}</span><button className="modal-close" onClick={()=>setPayModal(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:13,marginBottom:16}}>Net Salary: <strong style={{fontSize:18,color:'var(--success)'}}>{fmt(payModal.net_salary)}</strong></p>
              <p style={{color:'var(--text-muted)',fontSize:12}}>This will mark the salary as paid and record a cash transaction.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPayModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={()=>markPaid(payModal)}>✅ Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
      {editModal && (
        <div className="modal-overlay" onClick={()=>setEditModal(null)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">✏️ Edit Salary — {editModal.employee_name}</span><button className="modal-close" onClick={()=>setEditModal(null)}>✕</button></div>
            <form onSubmit={saveEdit}>
              <div className="modal-body">
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Base: <strong>{fmt(editModal.base_salary)}</strong></p>
                <div className="form-group"><label className="form-label">Bonus Amount (₹)</label><input type="number" className="form-control" value={editForm.bonus_amount} onChange={e=>setEditForm(p=>({...p,bonus_amount:e.target.value}))} min="0"/></div>
                <div className="form-group"><label className="form-label">Deduction Amount (₹)</label><input type="number" className="form-control" value={editForm.deduction_amount} onChange={e=>setEditForm(p=>({...p,deduction_amount:e.target.value}))} min="0"/></div>
                <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" value={editForm.notes} onChange={e=>setEditForm(p=>({...p,notes:e.target.value}))} rows={2}/></div>
                <div style={{marginTop:12,padding:12,background:'rgba(124,58,237,0.08)',borderRadius:8,textAlign:'center'}}>
                  <span style={{fontSize:13,color:'var(--text-muted)'}}>Net Salary: </span>
                  <strong style={{fontSize:18,color:'var(--primary-light)'}}>{fmt((editModal.base_salary||0)+Number(editForm.bonus_amount||0)-Number(editForm.deduction_amount||0))}</strong>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">💾 Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
