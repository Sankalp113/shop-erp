'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, where, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { saveExpenseTransaction } from '@/lib/firebase/transactions'
import { Plus, X, DollarSign } from 'lucide-react'
import type { Expense } from '@/types'

export default function ExpensesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [expenses, setExpenses]   = useState<Expense[]>([])
  const [categories, setCategories] = useState<{id:string;name:string}[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [month, setMonth]         = useState(currentMonth())
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({
    expenseDate: todayStr(), categoryId: '', description: '',
    amount: '', paymentMode: 'cash', vendorPerson: '', notes: '',
  })

  // Live expense listener
  useEffect(() => {
    setLoading(true)
    const q = query(
      collection(db, 'expenses'),
      where('expenseDate', '>=', `${month}-01`),
      where('expenseDate', '<=', `${month}-31`),
      orderBy('expenseDate', 'desc')
    )
    const unsub = onSnapshot(q,
      snap => { setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense)); setLoading(false) },
      () => setLoading(false)
    )
    return () => unsub()
  }, [month])

  // Load categories (static-ish — getDocs is fine)
  useEffect(() => {
    getDocs(query(collection(db, 'expenseCategories'), orderBy('name')))
      .then(snap => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() as any }))))
      .catch(() => {})
  }, [])

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.amount) return toast.error('Description and amount required')
    const cat = categories.find(c => c.id === form.categoryId)
    setSaving(true)
    try {
      await saveExpenseTransaction(
        {
          ...form,
          amount: Number(form.amount),
          categoryName: cat?.name || '',
        },
        user!.uid,
        user!.email || 'Staff'
      )
      toast.success('Expense recorded and all reports updated automatically.')
      setShowForm(false)
      setForm({ expenseDate: todayStr(), categoryId: '', description: '', amount: '', paymentMode: 'cash', vendorPerson: '', notes: '' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to save expense')
    }
    setSaving(false)
  }

  const total    = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const byMode: Record<string, number> = {}
  expenses.forEach(e => { byMode[e.paymentMode] = (byMode[e.paymentMode] || 0) + e.amount })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Miscellaneous Expenses</h1>
          <p className="page-subtitle flex items-center gap-2">
            Total: {formatCurrency(total)}
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Live
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <input type="month" className="form-input w-auto" value={month}
            onChange={e => setMonth(e.target.value)}/>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16}/> Add Expense
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {Object.entries(byMode).map(([mode, amt]) => (
          <div key={mode} className="kpi-card" style={{'--kpi-accent':'#F59E0B'} as any}>
            <p className="text-xs text-gray-500 uppercase tracking-wider capitalize">{mode}</p>
            <p className="text-xl font-bold text-white mt-1">{formatCurrency(amt)}</p>
          </div>
        ))}
        <div className="kpi-card" style={{'--kpi-accent':'#EF4444'} as any}>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-xl font-bold text-red-300 mt-1">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Mode</th><th>By</th></tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
                : expenses.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><DollarSign size={40} className="opacity-30 mb-3"/><p>No expenses this month</p></div></td></tr>
                : expenses.map(e => (
                  <tr key={e.id}>
                    <td>{formatDate(e.expenseDate)}</td>
                    <td><span className="badge badge-muted">{e.categoryName || '—'}</span></td>
                    <td className="text-gray-200">{e.description}</td>
                    <td className="font-semibold text-red-300">{formatCurrency(e.amount)}</td>
                    <td><span className="badge badge-info capitalize">{e.paymentMode}</span></td>
                    <td>{e.vendorPerson || '—'}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-md">
            <div className="modal-header">
              <h3 className="modal-title">Record Expense</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18}/></button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Date *</label>
                    <input type="date" className="form-input" value={form.expenseDate}
                      onChange={e => set('expenseDate', e.target.value)} required/>
                  </div>
                  <div><label className="form-label">Category</label>
                    <select className="form-select" value={form.categoryId}
                      onChange={e => set('categoryId', e.target.value)}>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="form-label">Description *</label>
                  <input className="form-input" value={form.description}
                    onChange={e => set('description', e.target.value)} required/>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Amount (₹) *</label>
                    <input type="number" className="form-input" value={form.amount}
                      onChange={e => set('amount', e.target.value)} required min="0" step="0.01"/>
                  </div>
                  <div><label className="form-label">Payment Mode</label>
                    <select className="form-select" value={form.paymentMode}
                      onChange={e => set('paymentMode', e.target.value)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option>
                      <option value="card">Card</option><option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div><label className="form-label">Paid To (Person/Vendor)</label>
                  <input className="form-input" value={form.vendorPerson}
                    onChange={e => set('vendorPerson', e.target.value)}/>
                </div>
                <div><label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes}
                    onChange={e => set('notes', e.target.value)} rows={2}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><div className="spinner w-4 h-4"/> Saving…</> : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
