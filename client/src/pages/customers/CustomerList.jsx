import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getCustomers, createCustomer, deleteCustomer, updateCustomer } from '../../services/db'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const BLANK = { name:'',mobile:'',email:'',address:'',city:'',credit_limit:0,opening_balance:0,notes:'' }

export default function CustomerList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [search])
  async function load() {
    setLoading(true)
    const r = await getCustomers({ search, limit: 100 })
    setCustomers(r.data); setLoading(false)
  }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  function openAdd() { setEditItem(null); setForm(BLANK); setShowForm(true) }
  function openEdit(c) {
    setEditItem(c)
    setForm({ name:c.name, mobile:c.mobile||'', email:c.email||'', address:c.address||'', city:c.city||'', credit_limit:c.credit_limit||0, opening_balance:c.opening_balance||0, notes:c.notes||'' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setForm(BLANK) }

  async function handleDelete(c) {
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return
    try { await deleteCustomer(c.id); toast.success('Customer deleted'); load() }
    catch (err) { toast.error(err.message || 'Failed to delete') }
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name) return toast.error('Customer name required')
    try {
      if (editItem) {
        await updateCustomer(editItem.id, form)
        toast.success('Customer updated')
      } else {
        await createCustomer(form)
        toast.success('Customer added')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const totalOutstanding = customers.reduce((s,c) => s + (c.outstanding||0), 0)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>👥 Customers</h1><p>{customers.length} customers · Credit outstanding: <strong style={{color:'var(--warning)'}}>{fmt(totalOutstanding)}</strong></p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Customer</button>
      </div>
      <input className="form-control" placeholder="🔍 Search customers..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:16}}/>
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : customers.length===0
              ? <div className="empty-state"><div className="empty-state-icon">👥</div><h3>No customers yet</h3><button className="btn btn-primary" style={{marginTop:16}} onClick={openAdd}>Add First Customer</button></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Code</th><th>Name</th><th>Mobile</th><th>City</th><th style={{textAlign:'right'}}>Total Bought</th><th style={{textAlign:'right'}}>Outstanding</th><th style={{textAlign:'right'}}>Credit Limit</th><th></th></tr></thead>
                <tbody>{customers.map(c=>(
                  <tr key={c.id}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.customer_code}</td>
                    <td><span className="table-link" onClick={()=>navigate(`/customers/${c.id}`)} style={{fontWeight:600}}>{c.name}</span></td>
                    <td style={{fontSize:12}}>{c.mobile||'—'}</td>
                    <td style={{fontSize:12}}>{c.city||'—'}</td>
                    <td style={{textAlign:'right'}}>{fmt(c.total_purchased)}</td>
                    <td style={{textAlign:'right',color:c.total_outstanding>0?'var(--warning)':'var(--text-muted)',fontWeight:c.total_outstanding>0?700:400}}>{fmt(c.total_outstanding)}</td>
                    <td style={{textAlign:'right',fontSize:12}}>{c.credit_limit>0?fmt(c.credit_limit):'—'}</td>
                    <td><div style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm btn-secondary" onClick={()=>navigate(`/customers/${c.id}`)}>View →</button>
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(c)}>✏️</button>
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={()=>handleDelete(c)}>🗑️</button>
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
            <div className="modal-header"><span className="modal-title">👤 {editItem?'Edit':'Add'} Customer</span><button className="modal-close" onClick={closeForm}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Mobile</label><input className="form-control" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={form.email} onChange={e=>set('email',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={e=>set('city',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Credit Limit (₹)</label><input type="number" className="form-control" value={form.credit_limit} onChange={e=>set('credit_limit',e.target.value)}/></div>
                  {!editItem && <div className="form-group"><label className="form-label">Opening Balance (₹)</label><input type="number" className="form-control" value={form.opening_balance} onChange={e=>set('opening_balance',e.target.value)}/></div>}
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Address</label><input className="form-control" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem?'💾 Update':'✅ Add'} Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
