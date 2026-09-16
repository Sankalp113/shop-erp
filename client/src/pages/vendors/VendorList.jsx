import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function VendorList() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'',company_name:'',mobile:'',email:'',address:'',city:'',gstin:'',payment_terms:30,opening_balance:0,notes:'' })

  useEffect(() => { load() }, [search])
  async function load() {
    setLoading(true)
    const r = await api.get('/vendors', { params: { search, limit: 100 } })
    setVendors(r.data.data); setLoading(false)
  }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function submit(e) {
    e.preventDefault()
    if (!form.name) return toast.error('Vendor name required')
    try {
      await api.post('/vendors', form)
      toast.success('Vendor added')
      setShowForm(false); setForm({ name:'',company_name:'',mobile:'',email:'',address:'',city:'',gstin:'',payment_terms:30,opening_balance:0,notes:'' }); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const totalOutstanding = vendors.reduce((s,v) => s + (v.total_outstanding||0), 0)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🏭 Vendors</h1><p>{vendors.length} vendors · Outstanding: <strong style={{color:'var(--danger)'}}>{fmt(totalOutstanding)}</strong></p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>➕ Add Vendor</button>
      </div>
      <input className="form-control" placeholder="🔍 Search vendors..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:16}} />
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : vendors.length===0
              ? <div className="empty-state"><div className="empty-state-icon">🏭</div><h3>No vendors yet</h3><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setShowForm(true)}>Add First Vendor</button></div>
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
                    <td><button className="btn btn-sm btn-secondary" onClick={()=>navigate(`/vendors/${v.id}`)}>View →</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🏭 Add Vendor</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Vendor Name *</label><input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Company Name</label><input className="form-control" value={form.company_name} onChange={e=>set('company_name',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Mobile</label><input className="form-control" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={e=>set('city',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">GSTIN</label><input className="form-control" value={form.gstin} onChange={e=>set('gstin',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Payment Terms (days)</label><input type="number" className="form-control" value={form.payment_terms} onChange={e=>set('payment_terms',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Opening Balance (₹)</label><input type="number" className="form-control" value={form.opening_balance} onChange={e=>set('opening_balance',e.target.value)}/></div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Address</label><input className="form-control" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Add Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
