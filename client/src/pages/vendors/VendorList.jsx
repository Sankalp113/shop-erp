import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getVendors, createVendor, deleteVendor, updateVendor } from '../../services/db'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const BLANK = { name:'',company_name:'',mobile:'',email:'',address:'',city:'',gstin:'',payment_terms:30,opening_balance:0,notes:'' }

export default function VendorList() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [search])
  async function load() {
    setLoading(true)
    const r = await getVendors({ search, limit: 100 })
    setVendors(r.data); setLoading(false)
  }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  function openAdd() { setEditItem(null); setForm(BLANK); setShowForm(true) }
  function openEdit(v) {
    setEditItem(v)
    setForm({ name:v.name, company_name:v.company_name||'', mobile:v.mobile||'', email:v.email||'', address:v.address||'', city:v.city||'', gstin:v.gstin||'', payment_terms:v.payment_terms||30, opening_balance:v.opening_balance||0, notes:v.notes||'' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setForm(BLANK) }

  async function handleDelete(v) {
    if (!window.confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return
    try { await deleteVendor(v.id); toast.success('Vendor deleted'); load() }
    catch (err) { toast.error(err.message || 'Failed to delete') }
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name) return toast.error('Vendor name required')
    try {
      if (editItem) {
        await updateVendor(editItem.id, form)
        toast.success('Vendor updated')
      } else {
        await createVendor(form)
        toast.success('Vendor added')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const totalOutstanding = vendors.reduce((s,v) => s + (v.total_outstanding||0), 0)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🏭 Vendors</h1><p>{vendors.length} vendors · Outstanding: <strong style={{color:'var(--danger)'}}>{fmt(totalOutstanding)}</strong></p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Vendor</button>
      </div>
      <input className="form-control" placeholder="🔍 Search vendors..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:16}} />
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : vendors.length===0
              ? <div className="empty-state"><div className="empty-state-icon">🏭</div><h3>No vendors yet</h3><button className="btn btn-primary" style={{marginTop:16}} onClick={openAdd}>Add First Vendor</button></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Code</th><th>Name</th><th>Company</th><th>Mobile</th><th>City</th><th style={{textAlign:'right'}}>Total Purchased</th><th style={{textAlign:'right'}}>Outstanding</th><th></th></tr></thead>
                <tbody>{vendors.map(v=>(
                  <tr key={v.id}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{v.vendor_code}</td>
                    <td><span className="table-link" onClick={()=>navigate(`/vendors/${v.id}`)} style={{fontWeight:600}}>{v.name}</span></td>
                    <td style={{fontSize:12}}>{v.company_name||'—'}</td>
                    <td style={{fontSize:12}}>{v.mobile||'—'}</td>
                    <td style={{fontSize:12}}>{v.city||'—'}</td>
                    <td style={{textAlign:'right'}}>{fmt(v.total_purchased)}</td>
                    <td style={{textAlign:'right',color:v.total_outstanding>0?'var(--danger)':'var(--text-muted)',fontWeight:v.total_outstanding>0?700:400}}>{fmt(v.total_outstanding)}</td>
                    <td><div style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm btn-secondary" onClick={()=>navigate(`/vendors/${v.id}`)}>View →</button>
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(v)}>✏️</button>
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={()=>handleDelete(v)}>🗑️</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🏭 {editItem?'Edit':'Add'} Vendor</span><button className="modal-close" onClick={closeForm}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Vendor Name *</label><input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Company Name</label><input className="form-control" value={form.company_name} onChange={e=>set('company_name',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Mobile</label><input className="form-control" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={e=>set('city',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">GSTIN</label><input className="form-control" value={form.gstin} onChange={e=>set('gstin',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Payment Terms (days)</label><input type="number" className="form-control" value={form.payment_terms} onChange={e=>set('payment_terms',e.target.value)}/></div>
                  {!editItem && <div className="form-group"><label className="form-label">Opening Balance (₹)</label><input type="number" className="form-control" value={form.opening_balance} onChange={e=>set('opening_balance',e.target.value)}/></div>}
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Address</label><input className="form-control" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem?'💾 Update':'✅ Add'} Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
