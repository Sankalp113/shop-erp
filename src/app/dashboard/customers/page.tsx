'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Users, Edit2, X, Phone, MapPin } from 'lucide-react'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editCust, setEditCust] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name:'', mobile:'', email:'', address:'', city:'', creditLimit:'0', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'customers'), orderBy('name')))
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Customer))
    } catch { toast.error('Failed to load — check Firebase config') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  function openAdd() { setEditCust(null); setForm({ name:'',mobile:'',email:'',address:'',city:'',creditLimit:'0',notes:'' }); setShowForm(true) }
  function openEdit(c: Customer) { setEditCust(c); setForm({ ...c, creditLimit: String(c.creditLimit||0) } as any); setShowForm(true) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return toast.error('Name required')
    const data = { name: form.name, mobile: form.mobile||null, email: form.email||null, address: form.address||null, city: form.city||null, creditLimit: Number(form.creditLimit)||0, notes: form.notes||null, outstanding: editCust?.outstanding||0, totalPurchases: editCust?.totalPurchases||0, totalPaid: editCust?.totalPaid||0, isActive: true }
    try {
      if (editCust) { await updateDoc(doc(db,'customers',editCust.id),{...data,updatedAt:serverTimestamp()}); toast.success('Customer updated') }
      else {
        const count = customers.length + 1
        await addDoc(collection(db,'customers'),{ ...data, code:`CUST${String(count).padStart(4,'0')}`, createdAt:serverTimestamp() })
        toast.success('Customer added')
      }
      setShowForm(false); load()
    } catch (err:any) { toast.error(err.message) }
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.mobile?.includes(q)
  })

  const totalOutstanding = customers.reduce((s,c)=>s+(c.outstanding||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Customers</h1><p className="page-subtitle">{customers.length} total · Outstanding: {formatCurrency(totalOutstanding)}</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Customer</button>
      </div>

      <div className="glass-card p-4 mb-5 flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input className="form-input pl-9" placeholder="Search name, mobile…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <span className="flex items-center text-sm text-gray-500">{filtered.length} results</span>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Mobile</th><th>City</th><th>Credit Limit</th><th className="text-right">Outstanding</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-12"><div className="spinner mx-auto"/></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><Users size={40}/></div><p>No customers found</p><button className="btn btn-primary btn-sm mt-3" onClick={openAdd}>Add First Customer</button></div></td></tr>
              : filtered.map(c => (
                <tr key={c.id}>
                  <td><div className="font-semibold text-gray-200">{c.name}</div><div className="text-xs text-gray-600">{c.code||''}</div></td>
                  <td><div className="flex items-center gap-1.5 text-gray-400"><Phone size={12}/>{c.mobile||'—'}</div></td>
                  <td>{c.city||'—'}</td>
                  <td>{formatCurrency(c.creditLimit||0)}</td>
                  <td className={`text-right font-semibold ${(c.outstanding||0)>0?'text-amber-400':'text-gray-400'}`}>{formatCurrency(c.outstanding||0)}</td>
                  <td><span className={`badge ${c.isActive!==false?'badge-success':'badge-muted'}`}>{c.isActive!==false?'Active':'Inactive'}</span></td>
                  <td><button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(c)}><Edit2 size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">{editCust?'Edit Customer':'Add Customer'}</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div><label className="form-label">Mobile</label><input className="form-input" value={form.mobile} onChange={e=>set('mobile',e.target.value)} placeholder="10-digit mobile"/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                  <div><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e=>set('city',e.target.value)}/></div>
                </div>
                <div><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                <div><label className="form-label">Credit Limit (₹)</label><input type="number" className="form-input" value={form.creditLimit} onChange={e=>set('creditLimit',e.target.value)} min="0"/></div>
                <div><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editCust?'Update':'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
