import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function Salary() {
  const [employees, setEmployees] = useState([])
  const [salaries, setSalaries] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().substring(0,7))
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [payModal, setPayModal] = useState(null)

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { loadSalaries() }, [month])

  async function loadEmployees() { const r = await api.get('/staff/employees'); setEmployees(r.data) }
  async function loadSalaries() {
    setLoading(true)
    const r = await api.get('/staff/salaries', { params: { month } })
    setSalaries(r.data.data || r.data); setLoading(false)
  }

  async function generate() {
    if (!confirm(`Generate salary records for ${month}?`)) return
    setGenerating(true)
    try {
      await api.post('/staff/salaries/generate', { month })
      toast.success('Salary records generated'); loadSalaries()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') } finally { setGenerating(false) }
  }

  async function markPaid(salary) {
    try {
      await api.post(`/staff/salary/${salary.id}/pay`, { payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash' })
      toast.success('Salary marked as paid'); loadSalaries(); setPayModal(null)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
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
                    <td>{s.status!=='paid' && <button className="btn btn-sm btn-success" onClick={()=>setPayModal(s)}>💳 Pay</button>}</td>
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
    </div>
  )
}
