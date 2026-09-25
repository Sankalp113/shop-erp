import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getReminders, createReminder, updateReminderStatus, updateReminder, deleteReminder } from '../services/db'


export default function Reminders() {
  const [reminders, setReminders] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ reminder_type:'custom', title:'', description:'', due_date:'', amount:'', priority:'normal' })


  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    const reminders = await getReminders({ status: filter })
    // compute counts
    const todayStr = new Date().toISOString().split('T')[0]
    const in7Days = new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
    const all = await getReminders({})
    setCounts({
      overdue: all.filter(r => r.due_date < todayStr && r.status === 'pending').length,
      due_today: all.filter(r => r.due_date === todayStr && r.status === 'pending').length,
      due_week: all.filter(r => r.due_date >= todayStr && r.due_date <= in7Days && r.status === 'pending').length,
      total_pending: all.filter(r => r.status === 'pending').length,
    })
    const enriched = reminders.map(r => {
      const urgency = r.due_date < todayStr ? 'overdue' : r.due_date === todayStr ? 'due_today' : r.due_date <= in7Days ? 'due_soon' : 'upcoming'
      return { ...r, urgency }
    })
    setReminders(enriched); setLoading(false)
  }

  async function complete(id) {
    await updateReminderStatus(id, 'completed'); toast.success('Marked complete'); load()
  }

  async function dismiss(id) { await updateReminderStatus(id, 'dismissed'); toast('Dismissed'); load() }

  function openAdd() { setEditItem(null); setForm({ reminder_type:'custom', title:'', description:'', due_date:'', amount:'', priority:'normal' }); setShowForm(true) }
  function openEdit(r) { setEditItem(r); setForm({ reminder_type: r.reminder_type, title: r.title, description: r.description||'', due_date: r.due_date, amount: r.amount||'', priority: r.priority }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null) }

  async function submit(e) {
    e.preventDefault()
    if (!form.title || !form.due_date) return toast.error('Title and due date required')
    try {
      if (editItem) { await updateReminder(editItem.id, form); toast.success('Reminder updated') }
      else { await createReminder(form); toast.success('Reminder added') }
      closeForm(); load()
    }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete reminder "${r.title}"?`)) return
    try { await deleteReminder(r.id); toast.success('Reminder deleted'); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  const URGENCY_STYLE = {
    overdue: { color:'var(--danger)', bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.3)', dot:'var(--danger)', label:'⚠️ OVERDUE' },
    due_today: { color:'var(--warning)', bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.3)', dot:'var(--warning)', label:'📅 DUE TODAY' },
    due_soon: { color:'var(--info)', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.3)', dot:'var(--info)', label:'🔔 DUE SOON' },
    upcoming: { color:'var(--text-muted)', bg:'var(--bg-card)', border:'var(--border)', dot:'var(--text-muted)', label:'📌' },
  }

  const TYPE_ICONS = { electricity:'⚡', rent:'🏠', salary:'💰', vendor:'🏭', custom:'📌', stock:'📦' }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h1>🔔 Reminders & Alerts</h1>
          <p>Stay on top of bills, payments, and deadlines</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Reminder</button>

      </div>

      {/* Count badges */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {[
          { label:'Overdue', count: counts.overdue, color:'var(--danger)' },
          { label:'Due Today', count: counts.due_today, color:'var(--warning)' },
          { label:'Due This Week', count: counts.due_week, color:'var(--info)' },
          { label:'Total Pending', count: counts.total_pending, color:'var(--text-secondary)' },
        ].map(s=>(
          <div key={s.label} className="card" style={{flex:1,minWidth:120}}>
            <div className="card-body" style={{textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.count||0}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[['pending','⏳ Pending'],['completed','✅ Completed'],['dismissed','🚫 Dismissed']].map(([v,l])=>(
          <button key={v} className={`tab ${filter===v?'active':''}`} onClick={()=>setFilter(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
        : reminders.length===0
          ? <div className="empty-state"><div className="empty-state-icon">🔔</div><h3>{filter==='pending'?'No pending reminders! You\'re all caught up.':'No records.'}</h3></div>
          : <div style={{display:'grid',gap:10}}>
            {reminders.map(r=>{
              const style = URGENCY_STYLE[r.urgency] || URGENCY_STYLE.upcoming
              return (
                <div key={r.id} style={{background:style.bg,border:`1px solid ${style.border}`,borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:14,transition:'all 0.2s'}}>
                  <span style={{fontSize:22,flexShrink:0}}>{TYPE_ICONS[r.reminder_type]||'📌'}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:14}}>{r.title}</span>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:style.bg,color:style.color,border:`1px solid ${style.border}`,fontWeight:700}}>{style.label}</span>
                      <span className={`badge ${r.priority==='critical'?'badge-danger':r.priority==='high'?'badge-warning':'badge-muted'}`}>{r.priority}</span>
                    </div>
                    {r.description && <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>{r.description}</div>}
                    <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-muted)'}}>
                      <span>📅 Due: <strong style={{color:style.color}}>{r.due_date}</strong></span>
                      {r.amount && <span>💰 Amount: <strong>{`₹${Number(r.amount).toLocaleString('en-IN')}`}</strong></span>}
                    </div>
                  </div>
                  {filter === 'pending' && (
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(r)} title="Edit">✏️</button>
                      <button className="btn btn-sm btn-success" onClick={()=>complete(r.id)}>✅ Done</button>
                      <button className="btn btn-sm btn-ghost" onClick={()=>dismiss(r.id)}>✕</button>
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={()=>handleDelete(r)} title="Delete">🗑️</button>
                    </div>
                  )}
                  {filter !== 'pending' && (
                    <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={()=>handleDelete(r)} title="Delete">🗑️</button>
                  )}
                </div>
              )
            })}
          </div>
      }

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editItem ? '✏️ Edit Reminder' : '🔔 Add Reminder'}</span><button className="modal-close" onClick={closeForm}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Title *</label><input className="form-control" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} required/></div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={2}/></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Due Date *</label><input type="date" className="form-control" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} required/></div>
                  <div className="form-group"><label className="form-label">Amount (optional)</label><input type="number" className="form-control" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))}/></div>
                  <div className="form-group"><label className="form-label">Priority</label>
                    <select className="form-control" value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                    </select></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? '💾 Update' : '✅ Add'} Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
