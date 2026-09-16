'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Bell, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import type { Reminder } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: any }> = {
  upcoming:  { label: 'Upcoming', badge: 'badge-info', icon: Clock },
  due_soon:  { label: 'Due Soon', badge: 'badge-warning', icon: AlertTriangle },
  due_today: { label: 'Due Today', badge: 'badge-warning', icon: AlertTriangle },
  overdue:   { label: 'Overdue', badge: 'badge-danger', icon: AlertTriangle },
  completed: { label: 'Done', badge: 'badge-success', icon: CheckCircle },
  dismissed: { label: 'Dismissed', badge: 'badge-muted', icon: Clock },
}

function getReminderStatus(dueDate: string): Reminder['status'] {
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(dueDate); due.setHours(0,0,0,0)
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'due_today'
  if (diff <= 3) return 'due_soon'
  return 'upcoming'
}

export default function RemindersPage() {
  const { user } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'pending'|'completed'>('pending')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', reminderType: 'custom' as Reminder['reminderType'], dueDate: todayStr(), amount: '', description: '', priority: 'normal' as Reminder['priority'] })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'reminders'), orderBy('dueDate')))
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reminder))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.dueDate) return toast.error('Title and due date required')
    const status = getReminderStatus(form.dueDate)
    try {
      await addDoc(collection(db, 'reminders'), { ...form, amount: form.amount ? Number(form.amount) : null, status, createdAt: serverTimestamp() })
      toast.success('Reminder added'); setShowForm(false); load()
    } catch (err: any) { toast.error(err.message) }
  }

  async function complete(r: Reminder) {
    try {
      await updateDoc(doc(db, 'reminders', r.id), { status: 'completed', completedAt: serverTimestamp() })
      toast.success('Marked as done'); load()
    } catch {}
  }

  async function dismiss(r: Reminder) {
    try {
      await updateDoc(doc(db, 'reminders', r.id), { status: 'dismissed' })
      load()
    } catch {}
  }

  const shown = reminders.filter(r => {
    if (filter === 'pending') return r.status !== 'completed' && r.status !== 'dismissed'
    if (filter === 'completed') return r.status === 'completed'
    return true
  })

  const overdueCount = reminders.filter(r => r.status === 'overdue').length
  const dueSoonCount = reminders.filter(r => r.status === 'due_soon' || r.status === 'due_today').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Reminders & Alerts</h1>
          <p className="page-subtitle">
            {overdueCount > 0 && <span className="text-red-400 font-semibold">{overdueCount} overdue</span>}
            {overdueCount > 0 && dueSoonCount > 0 && ' · '}
            {dueSoonCount > 0 && <span className="text-amber-400">{dueSoonCount} due soon</span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add Reminder</button>
      </div>

      <div className="tabs mb-5">
        {(['pending','all','completed'] as const).map(f => (
          <button key={f} className={`tab ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f==='pending'?'Active':f==='completed'?'Completed':'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner spinner-lg" /></div>
        : shown.length === 0 ? <div className="empty-state"><Bell size={48} className="opacity-20 mb-4" /><p>No reminders found</p></div>
          : (
            <div className="space-y-2">
              {shown.map(r => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.upcoming
                const Icon = cfg.icon
                return (
                  <div key={r.id} className={`glass-card px-5 py-4 flex items-center gap-4 ${r.status === 'overdue' ? 'border-red-500/30' : r.status === 'due_today' || r.status === 'due_soon' ? 'border-amber-500/25' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.status === 'overdue' ? 'bg-red-500/15 text-red-400' : r.status === 'due_today' || r.status === 'due_soon' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-200">{r.title}</span>
                        <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                        {r.priority === 'critical' && <span className="badge badge-danger">Critical</span>}
                        {r.priority === 'high' && <span className="badge badge-warning">High</span>}
                      </div>
                      {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-600">Due: {formatDate(r.dueDate)}</span>
                        {r.amount && <span className="text-xs font-semibold text-amber-300">{formatCurrency(r.amount)}</span>}
                        <span className="text-xs text-gray-600 capitalize">{r.reminderType?.replace('_',' ')}</span>
                      </div>
                    </div>
                    {r.status !== 'completed' && r.status !== 'dismissed' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button className="btn btn-success btn-sm" onClick={() => complete(r)}><CheckCircle size={14} /> Done</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => dismiss(r)}>Dismiss</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Add Reminder</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} required /></div>
                <div className="form-row">
                  <div><label className="form-label">Type</label>
                    <select className="form-select" value={form.reminderType} onChange={e => set('reminderType', e.target.value)}>
                      <option value="custom">Custom</option><option value="vendor_payment">Vendor Payment</option><option value="customer_payment">Customer Payment</option><option value="electricity">Electricity</option><option value="rent">Rent</option><option value="salary">Salary</option>
                    </select>
                  </div>
                  <div><label className="form-label">Priority</label>
                    <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Due Date *</label><input type="date" className="form-input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} required /></div>
                  <div><label className="form-label">Amount (₹)</label><input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" /></div>
                </div>
                <div><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
