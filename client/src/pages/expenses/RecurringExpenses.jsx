import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getExpenseCategories, getRecurringExpenses, createRecurringExpense, toggleRecurringExpense } from '../../services/db'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function RecurringExpenses() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', category_id:'', amount:'', frequency:'monthly', next_due_date:'', payment_mode:'cash', vendor_person:'', notes:'' })

  useEffect(() => {
    getExpenseCategories().then(setCategories)
    load()
  }, [])

  async function load() { const items = await getRecurringExpenses(); setItems(items); setLoading(false) }
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function submit(e) {
    e.preventDefault()
    if (!form.name || !form.amount || !form.next_due_date) return toast.error('Fill required fields')
    const cat = categories.find(c => c.id === form.category_id)
    try { await createRecurringExpense({ ...form, category_name: cat?.name || '' }); toast.success('Recurring expense added'); setShowForm(false); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  async function toggleActive(item) {
    await toggleRecurringExpense(item.id, !item.is_active)
    toast.success(item.is_active ? 'Paused' : 'Activated'); load()
  }

  const FREQ_COLORS = { daily:'badge-danger', weekly:'badge-warning', monthly:'badge-primary', quarterly:'badge-info', annual:'badge-muted' }
  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🔄 Recurring Expenses</h1><p>Auto-tracked recurring bills and subscriptions</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>➕ Add Recurring</button>
      </div>
      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : items.length===0
              ? <div className="empty-state"><div className="empty-state-icon">🔄</div><h3>No recurring expenses</h3><p>Add recurring bills like internet, subscription, etc.</p></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Name</th><th>Frequency</th><th>Category</th><th>Next Due</th><th style={{textAlign:'right'}}>Amount</th><th>Payment</th><th>Status</th><th></th></tr></thead>
                <tbody>{items.map(it=>(
                  <tr key={it.id}>
                    <td style={{fontWeight:600,color:'var(--text-primary)'}}>{it.name}</td>
                    <td><span className={`badge ${FREQ_COLORS[it.frequency]||'badge-muted'}`}>{it.frequency}</span></td>
                    <td style={{fontSize:12}}>{it.category_name||'—'}</td>
                    <td style={{fontSize:12,color:it.next_due_date<=today?'var(--danger)':'var(--text-muted)',fontWeight:it.next_due_date<=today?700:400}}>
                      {it.next_due_date} {it.next_due_date<=today&&'⚠️'}
                    </td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(it.amount)}</td>
                    <td style={{fontSize:12}}>{it.payment_mode||'—'}</td>
                    <td><span className={`badge ${it.is_active?'badge-success':'badge-muted'}`}>{it.is_active?'Active':'Paused'}</span></td>
                    <td><button className={`btn btn-sm ${it.is_active?'btn-secondary':'btn-primary'}`} onClick={()=>toggleActive(it)}>{it.is_active?'⏸ Pause':'▶ Resume'}</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🔄 Add Recurring Expense</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Internet Bill, Software Subscription" required/></div>
                  <div className="form-group"><label className="form-label">Category</label>
                    <select className="form-control" value={form.category_id} onChange={e=>set('category_id',e.target.value)}>
                      <option value="">No category</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Frequency</label>
                    <select className="form-control" value={form.frequency} onChange={e=>set('frequency',e.target.value)}>
                      <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                    </select></div>
                  <div className="form-group"><label className="form-label">Amount *</label><input type="number" className="form-control" value={form.amount} onChange={e=>set('amount',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Next Due Date *</label><input type="date" className="form-control" value={form.next_due_date} onChange={e=>set('next_due_date',e.target.value)} required/></div>
                  <div className="form-group"><label className="form-label">Payment Mode</label>
                    <select className="form-control" value={form.payment_mode} onChange={e=>set('payment_mode',e.target.value)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="auto-debit">Auto Debit</option>
                    </select></div>
                  <div className="form-group"><label className="form-label">Vendor / Person</label><input className="form-control" value={form.vendor_person} onChange={e=>set('vendor_person',e.target.value)}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
