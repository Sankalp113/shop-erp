'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, UserCheck, Edit2 } from 'lucide-react'
import type { Employee } from '@/types'

export default function EmployeesPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee|null>(null)
  const [form, setForm] = useState({ name:'', designation:'', mobile:'', email:'', joiningDate:todayStr(), basicSalary:'', address:'', bankName:'', bankAccount:'', bankIfsc:'', status:'active' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db,'employees'), orderBy('name')))
      setEmployees(snap.docs.map(d=>({id:d.id,...d.data()}) as Employee))
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }, [])

  useEffect(()=>{load()},[load])
  const set = (k:string,v:any)=>setForm(p=>({...p,[k]:v}))
  function openAdd(){setEditEmp(null);setForm({name:'',designation:'',mobile:'',email:'',joiningDate:todayStr(),basicSalary:'',address:'',bankName:'',bankAccount:'',bankIfsc:'',status:'active'});setShowForm(true)}
  function openEdit(e:Employee){setEditEmp(e);setForm({...e,basicSalary:String(e.basicSalary||0)} as any);setShowForm(true)}

  async function submit(e:React.FormEvent){
    e.preventDefault()
    if(!form.name||!form.basicSalary) return toast.error('Name and salary required')
    const data={...form,basicSalary:Number(form.basicSalary)}
    try{
      if(editEmp){await updateDoc(doc(db,'employees',editEmp.id),{...data,updatedAt:serverTimestamp()});toast.success('Employee updated')}
      else{
        const count=employees.length+1
        await addDoc(collection(db,'employees'),{...data,code:`EMP${String(count).padStart(4,'0')}`,createdAt:serverTimestamp()})
        toast.success('Employee added')
      }
      setShowForm(false);load()
    }catch(err:any){toast.error(err.message)}
  }

  const totalSalary=employees.filter(e=>e.status==='active').reduce((s,e)=>s+(e.basicSalary||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Employees</h1><p className="page-subtitle">{employees.filter(e=>e.status==='active').length} active · Monthly payroll: {formatCurrency(totalSalary)}</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Employee</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Designation</th><th>Mobile</th><th>Joining Date</th><th className="text-right">Basic Salary</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
              :employees.length===0?<tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><UserCheck size={40}/></div><p>No employees yet</p><button className="btn btn-primary btn-sm mt-3" onClick={openAdd}>Add First Employee</button></div></td></tr>
              :employees.map(e=>(
                <tr key={e.id}>
                  <td><div className="font-semibold text-gray-200">{e.name}</div><div className="text-xs text-gray-600">{e.code||''}</div></td>
                  <td>{e.designation||'—'}</td>
                  <td>{e.mobile||'—'}</td>
                  <td>{formatDate(e.joiningDate||'')}</td>
                  <td className="text-right font-semibold text-gray-200">{formatCurrency(e.basicSalary||0)}</td>
                  <td><span className={`badge ${e.status==='active'?'badge-success':e.status==='resigned'?'badge-danger':'badge-muted'}`}>{e.status}</span></td>
                  <td><button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(e)}><Edit2 size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-lg">
            <div className="modal-header"><h3 className="modal-title">{editEmp?'Edit Employee':'Add Employee'}</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div><label className="form-label">Designation</label><input className="form-input" value={form.designation} onChange={e=>set('designation',e.target.value)}/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Mobile</label><input className="form-input" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                  <div><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Joining Date</label><input type="date" className="form-input" value={form.joiningDate} onChange={e=>set('joiningDate',e.target.value)}/></div>
                  <div><label className="form-label">Basic Salary (₹/month) *</label><input type="number" className="form-input" value={form.basicSalary} onChange={e=>set('basicSalary',e.target.value)} required min="0"/></div>
                </div>
                <div><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider mt-2">Bank Details</p>
                <div className="form-row-3">
                  <div><label className="form-label">Bank Name</label><input className="form-input" value={form.bankName} onChange={e=>set('bankName',e.target.value)}/></div>
                  <div><label className="form-label">Account No.</label><input className="form-input" value={form.bankAccount} onChange={e=>set('bankAccount',e.target.value)}/></div>
                  <div><label className="form-label">IFSC Code</label><input className="form-input" value={form.bankIfsc} onChange={e=>set('bankIfsc',e.target.value.toUpperCase())}/></div>
                </div>
                {editEmp && (
                  <div><label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={e=>set('status',e.target.value)}>
                      <option value="active">Active</option><option value="inactive">Inactive</option><option value="resigned">Resigned</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editEmp?'Update':'Add Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
