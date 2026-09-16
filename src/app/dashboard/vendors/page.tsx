'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Store, Edit2, X } from 'lucide-react'
import type { Vendor } from '@/types'

export default function VendorsPage() {
  const { user } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState({ name:'', companyName:'', contactPerson:'', mobile:'', email:'', address:'', city:'', gstin:'', paymentTerms:'30', bankName:'', bankAccount:'', bankIfsc:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'vendors'), orderBy('name')))
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Vendor))
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  function openAdd() { setEditVendor(null); setForm({ name:'',companyName:'',contactPerson:'',mobile:'',email:'',address:'',city:'',gstin:'',paymentTerms:'30',bankName:'',bankAccount:'',bankIfsc:'',notes:'' }); setShowForm(true) }
  function openEdit(v: Vendor) { setEditVendor(v); setForm({ ...v, paymentTerms: String(v.paymentTerms||30) } as any); setShowForm(true) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return toast.error('Vendor name required')
    const data = { ...form, paymentTerms: Number(form.paymentTerms)||30, outstanding: editVendor?.outstanding||0, openingBalance: editVendor?.openingBalance||0, isActive: true }
    try {
      if (editVendor) { await updateDoc(doc(db,'vendors',editVendor.id),{...data,updatedAt:serverTimestamp()}); toast.success('Vendor updated') }
      else {
        const count = vendors.length + 1
        await addDoc(collection(db,'vendors'),{ ...data, code:`VEN${String(count).padStart(4,'0')}`, createdAt:serverTimestamp() })
        toast.success('Vendor added')
      }
      setShowForm(false); load()
    } catch (err:any) { toast.error(err.message) }
  }

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    return !q || v.name?.toLowerCase().includes(q) || v.mobile?.includes(q) || v.companyName?.toLowerCase().includes(q)
  })

  const totalOutstanding = vendors.reduce((s,v)=>s+(v.outstanding||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Vendors</h1><p className="page-subtitle">{vendors.length} vendors · Outstanding: {formatCurrency(totalOutstanding)}</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Vendor</button>
      </div>

      <div className="glass-card p-4 mb-5 flex gap-3">
        <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/><input className="form-input pl-9" placeholder="Search name, mobile…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Vendor</th><th>Mobile</th><th>GSTIN</th><th>Payment Terms</th><th className="text-right">Outstanding</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center py-12"><div className="spinner mx-auto"/></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><Store size={40}/></div><p>No vendors found</p><button className="btn btn-primary btn-sm mt-3" onClick={openAdd}>Add First Vendor</button></div></td></tr>
              : filtered.map(v => (
                <tr key={v.id}>
                  <td><div className="font-semibold text-gray-200">{v.name}</div><div className="text-xs text-gray-600">{v.companyName||v.code||''}</div></td>
                  <td>{v.mobile||'—'}</td>
                  <td><span className="text-xs font-mono text-gray-400">{v.gstin||'—'}</span></td>
                  <td>{v.paymentTerms||30} days</td>
                  <td className={`text-right font-semibold ${(v.outstanding||0)>0?'text-red-400':'text-gray-400'}`}>{formatCurrency(v.outstanding||0)}</td>
                  <td><button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(v)}><Edit2 size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-lg">
            <div className="modal-header"><h3 className="modal-title">{editVendor?'Edit Vendor':'Add Vendor'}</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Vendor Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div><label className="form-label">Company Name</label><input className="form-input" value={form.companyName} onChange={e=>set('companyName',e.target.value)}/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Contact Person</label><input className="form-input" value={form.contactPerson} onChange={e=>set('contactPerson',e.target.value)}/></div>
                  <div><label className="form-label">Mobile</label><input className="form-input" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                  <div><label className="form-label">GSTIN</label><input className="form-input" value={form.gstin} onChange={e=>set('gstin',e.target.value.toUpperCase())} maxLength={15} placeholder="15-digit GSTIN"/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e=>set('city',e.target.value)}/></div>
                  <div><label className="form-label">Payment Terms (days)</label><input type="number" className="form-input" value={form.paymentTerms} onChange={e=>set('paymentTerms',e.target.value)} min="0"/></div>
                </div>
                <div><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider mt-2">Bank Details</p>
                <div className="form-row-3">
                  <div><label className="form-label">Bank Name</label><input className="form-input" value={form.bankName} onChange={e=>set('bankName',e.target.value)}/></div>
                  <div><label className="form-label">Account No.</label><input className="form-input" value={form.bankAccount} onChange={e=>set('bankAccount',e.target.value)}/></div>
                  <div><label className="form-label">IFSC Code</label><input className="form-input" value={form.bankIfsc} onChange={e=>set('bankIfsc',e.target.value.toUpperCase())}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editVendor?'Update':'Add Vendor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
