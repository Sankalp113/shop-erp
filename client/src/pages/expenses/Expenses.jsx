import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('this_month')
  const [catId, setCatId] = useState('')
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ expense_date: new Date().toISOString().split('T')[0], category_id:'', description:'', amount:'', payment_mode:'cash', vendor_person:'', notes:'' })

  useEffect(() => { api.get('/expenses/categories').then(r=>setCategories(r.data)) }, [])
  useEffect(() => { load() }, [period, catId])

  async function load() {
    setLoading(true)
    const r = await api.get('/expenses', { params: { period: period !== 'custom' ? period : undefined, category_id: catId, limit: 100 } })
    setExpenses(r.data.data); setTotal(r.data.total_amount); setLoading(false)
  }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function submit(e) {
    e.preventDefault()
    if (!form.description || !form.amount) return toast.error('Description and amount required')
    try {
      await api.post('/expenses', form); toast.success('Expense recorded')
      setShowForm(false); setForm({ expense_date: new Date().toISOString().split('T')[0], category_id:'', description:'', amount:'', payment_mode:'cash', vendor_person:'', notes:'' }); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>💸 Miscellaneous Expenses</h1><p>Track all business expenses</p></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div className="stat-chip"><span className="stat-chip-value" style={{color:'var(--danger)'}}>{fmt(total)}</span><span className="stat-chip-label">Total</span></div>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}>➕ Add Expense</button>
        </div>
      </div>

      <div className="date-filter">
        {['today','this_week','this_month','last_month'].map(p=>(
          <button key={p} className={`date-filter-btn ${period===p?'active':''}`} onClick={()=>setPeriod(p)}>
            {p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
        <select className="form-control" value={catId} onChange={e=>setCatId(e.target.value)} style={{width:160,marginLeft:'auto'}}>
          <option value="">All Categories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : expenses.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">💸</div><h3>No expenses found</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payment</th><th>Vendor / Person</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                <tbody>{expenses.map(e=>(
                  <tr key={e.id}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{e.expense_date}</td>
                    <td style={{fontSize:12}}>{e.category_name||'—'}</td>
                    <td style={{fontWeight:500}}>{e.description}</td>
                    <td><span className="badge badge-info">{(e.payment_mode||'').toUpperCase()}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{e.vendor_person||'—'}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:'var(--danger)'}}>{fmt(e.amount)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💸 Add Expense</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-control" value={form.expense_date} onChange={e=>set('expense_date',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Category</label>
                    <select className="form-control" value={form.category_id} onChange={e=>set('category_id',e.target.value)}>
                      <option value="">Select category</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Description *</label><input className="form-control" value={form.description} onChange={e=>set('description',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Amount *</label><input type="number" className="form-control" value={form.amount} onChange={e=>set('amount',e.target.value)} step="0.01" required/></div>
                  <div className="form-group"><label className="form-label">Payment Mode</label>
                    <select className="form-control" value={form.payment_mode} onChange={e=>set('payment_mode',e.target.value)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option>
                    </select></div>
                  <div className="form-group"><label className="form-label">Paid To (Person/Vendor)</label><input className="form-control" value={form.vendor_person} onChange={e=>set('vendor_person',e.target.value)}/></div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Notes</label><textarea className="form-control" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">✅ Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
