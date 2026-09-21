import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getEmployees, getAttendance, saveAttendance } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

export default function Attendance() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [month, setMonth] = useState(new Date().toISOString().substring(0,7))
  const [tab, setTab] = useState('daily')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statuses, setStatuses] = useState({})

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { if(tab==='daily') loadDaily(); else loadMonthly() }, [date, month, tab])

  async function loadEmployees() {
    const emps = await getEmployees()
    setEmployees(emps)
  }

  async function loadDaily() {
    setLoading(true)
    const recs = await getAttendance({ date })
    const map = {}
    recs.forEach(a => map[a.employee_id] = { status: a.status, check_in: a.check_in_time, check_out: a.check_out_time, notes: a.notes||'' })
    setStatuses(map); setLoading(false)
  }

  async function loadMonthly() {
    setLoading(true)
    const recs = await getAttendance({ month })
    setAttendance(recs); setLoading(false)
  }

  function setStatus(empId, field, value) {
    setStatuses(prev => ({ ...prev, [empId]: { ...(prev[empId]||{status:'present'}), [field]: value } }))
  }

  async function saveDaily() {
    setSaving(true)
    try {
      const records = employees.map(e => ({
        employee_id: e.id, employee_name: e.name,
        attendance_date: date,
        status: statuses[e.id]?.status || 'present',
        check_in_time: statuses[e.id]?.check_in || null,
        check_out_time: statuses[e.id]?.check_out || null,
        notes: statuses[e.id]?.notes || '',
      }))
      await saveAttendance(records, user?.uid)
      toast.success('Attendance saved')
    } catch (err) { toast.error(err.message || 'Failed') } finally { setSaving(false) }
  }

  const STATUS_OPTS = [
    { v:'present', l:'Present', color:'var(--success)' },
    { v:'absent', l:'Absent', color:'var(--danger)' },
    { v:'half_day', l:'Half Day', color:'var(--warning)' },
    { v:'leave', l:'Leave', color:'var(--info)' },
    { v:'holiday', l:'Holiday', color:'var(--accent)' },
  ]

  return (
    <div>
      <div className="page-header"><h1>✅ Attendance</h1><p>Mark and review staff attendance</p></div>
      <div className="tabs">
        {[['daily','📅 Daily'],['monthly','📆 Monthly Summary']].map(([t,l]) => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {tab === 'daily' && (
        <>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
            <div><label className="form-label" style={{display:'block'}}>Date</label>
              <input type="date" className="form-control" value={date} onChange={e=>setDate(e.target.value)} style={{width:'auto'}}/></div>
            <div style={{display:'flex',gap:6,marginLeft:'auto',flexWrap:'wrap'}}>
              <button className="btn btn-secondary btn-sm" onClick={() => employees.forEach(e => setStatus(e.id,'status','present'))}>✅ All Present</button>
              <button className="btn btn-primary" onClick={saveDaily} disabled={saving}>{saving?'⏳ Saving...':'💾 Save Attendance'}</button>
            </div>
          </div>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : employees.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">👷</div><h3>No employees yet. Add employees first.</h3></div>
              : <div className="card">
                <div className="card-body" style={{padding:0}}>
                  <table className="table">
                    <thead><tr><th>Employee</th><th>Designation</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Notes</th></tr></thead>
                    <tbody>{employees.map(e => {
                      const s = statuses[e.id] || { status:'present' }
                      const sc = STATUS_OPTS.find(o=>o.v===s.status)
                      return (
                        <tr key={e.id}>
                          <td style={{fontWeight:600}}>{e.name}</td>
                          <td style={{fontSize:12,color:'var(--text-muted)'}}>{e.designation||'—'}</td>
                          <td>
                            <select value={s.status||'present'} onChange={ev=>setStatus(e.id,'status',ev.target.value)}
                              style={{background:'var(--bg-input)',border:`1px solid ${sc?.color||'var(--border)'}`,borderRadius:6,padding:'5px 10px',color:sc?.color||'var(--text-primary)',fontSize:12,outline:'none',cursor:'pointer'}}>
                              {STATUS_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </td>
                          <td><input type="time" value={s.check_in||''} onChange={ev=>setStatus(e.id,'check_in',ev.target.value)}
                            style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 10px',color:'var(--text-primary)',fontSize:12,width:110}}/></td>
                          <td><input type="time" value={s.check_out||''} onChange={ev=>setStatus(e.id,'check_out',ev.target.value)}
                            style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 10px',color:'var(--text-primary)',fontSize:12,width:110}}/></td>
                          <td><input value={s.notes||''} onChange={ev=>setStatus(e.id,'notes',ev.target.value)} placeholder="Notes..."
                            style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 10px',color:'var(--text-primary)',fontSize:12,width:'100%'}}/></td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                </div>
              </div>
          }
        </>
      )}

      {tab === 'monthly' && (
        <>
          <div style={{marginBottom:16}}>
            <input type="month" className="form-control" value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto'}}/>
          </div>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : <div className="card">
              <div className="card-body" style={{padding:0}}>
                <div className="table-container"><table className="table">
                  <thead><tr><th>Employee</th><th style={{textAlign:'center'}}>Present</th><th style={{textAlign:'center'}}>Absent</th><th style={{textAlign:'center'}}>Half Day</th><th style={{textAlign:'center'}}>Leave</th><th style={{textAlign:'center'}}>Holiday</th></tr></thead>
                  <tbody>{Object.entries(attendance.reduce((acc,a)=>{ if(!acc[a.employee_id])acc[a.employee_id]={name:a.employee_name,present:0,absent:0,half_day:0,leave:0,holiday:0}; acc[a.employee_id][a.status]=(acc[a.employee_id][a.status]||0)+1; return acc },{})).map(([id,s])=>(
                    <tr key={id}><td style={{fontWeight:600}}>{s.name}</td><td style={{textAlign:'center',color:'var(--success)',fontWeight:700}}>{s.present}</td><td style={{textAlign:'center',color:'var(--danger)',fontWeight:700}}>{s.absent}</td><td style={{textAlign:'center',color:'var(--warning)',fontWeight:700}}>{s.half_day}</td><td style={{textAlign:'center',color:'var(--info)',fontWeight:700}}>{s.leave}</td><td style={{textAlign:'center',color:'var(--accent)',fontWeight:700}}>{s.holiday}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            </div>
          }
        </>
      )}
    </div>
  )
}
