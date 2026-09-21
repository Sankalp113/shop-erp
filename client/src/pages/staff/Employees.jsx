import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getEmployees, createEmployee, updateEmployee } from '../../services/db'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState({ name:'',designation:'',mobile:'',email:'',salary_type:'monthly',basic_salary:'',joining_date:new Date().toISOString().split('T')[0],address:'',emergency_contact:'',notes:'' })

  useEffect(() => { load() }, [])
  async function load() {
    const emps = await getEmployees()
    setEmployees(emps); setLoading(false)
  }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  function openAdd() { setEditEmp(null); setForm({ name:'',designation:'',mobile:'',email:'',salary_type:'monthly',basic_salary:'',joining_date:new Date().toISOString().split('T')[0],address:'',emergency_contact:'',notes:'' }); setShowForm(true) }
  function openEdit(emp) { setEditEmp(emp); setForm({...emp}); setShowForm(true) }

  async function submit(e) {
    e.preventDefault()
    if (!form.name || !form.basic_salary) return toast.error('Name and salary required')
    try {
      if (editEmp) { await updateEmployee(editEmp.id, form); toast.success('Employee updated') }
      else { await createEmployee(form); toast.success('Employee added') }
      setShowForm(false); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🪪 Employees</h1><p>{employees.length} staff members</p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Employee</button>
      </div>
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : employees.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">👷</div><h3>No employees yet</h3><button className="btn btn-primary" style={{marginTop:16}} onClick={openAdd}>Add First Employee</button></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Mobile</th><th>Salary Type</th><th style={{textAlign:'right'}}>Base Salary</th><th>Join Date</th><th>Status</th><th></th></tr></thead>
                <tbody>{employees.map(e => (
                  <tr key={e.id}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{e.employee_code}</td>
                    <td style={{fontWeight:600,color:'var(--text-primary)'}}>{e.name}</td>
                    <td style={{fontSize:12}}>{e.designation||'—'}</td>
                    <td style={{fontSize:12}}>{e.mobile||'—'}</td>
                    <td><span className="badge badge-info">{e.salary_type||'monthly'}</span></td>
                    <td style={{textAlign:'right',fontWeight:700}}>₹{Number(e.basic_salary).toLocaleString('en-IN')}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{e.joining_date}</td>
                    <td><span className={`badge ${e.status!=='inactive'?'badge-success':'badge-muted'}`}>{e.status!=='inactive'?'Active':'Inactive'}</span></td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => openEdit(e)}>✏️</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editEmp?'✏️ Edit':'➕ Add'} Employee</span><button className="modal-close" onClick={() => setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Designation</label><input className="form-control" value={form.designation} onChange={e=>set('designation',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Mobile</label><input className="form-control" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Salary Type</label>
                    <select className="form-control" value={form.salary_type} onChange={e=>set('salary_type',e.target.value)}>
                      <option value="monthly">Monthly</option><option value="daily">Daily</option><option value="hourly">Hourly</option><option value="commission">Commission</option>
                    </select></div>
                  <div className="form-group"><label className="form-label">Base Salary *</label><input type="number" className="form-control" value={form.basic_salary} onChange={e=>set('basic_salary',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Join Date</label><input type="date" className="form-control" value={form.joining_date} onChange={e=>set('joining_date',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Emergency Contact</label><input className="form-control" value={form.emergency_contact} onChange={e=>set('emergency_contact',e.target.value)}/></div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Address</label><input className="form-control" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                  {editEmp && (
                    <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="checkbox" id="isActive" checked={form.is_active} onChange={e=>set('is_active',e.target.checked?1:0)}/>
                      <label htmlFor="isActive" style={{cursor:'pointer',fontSize:13}}>Active Employee</label>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ {editEmp?'Update':'Add'} Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
