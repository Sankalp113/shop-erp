'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Zap } from 'lucide-react'
import type { ElectricityBill } from '@/types'

export default function ElectricityPage() {
  const { user } = useAuth()
  const [bills, setBills] = useState<ElectricityBill[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ consumerNumber: '', meterNumber: '', billDate: todayStr(), billingPeriodStart: '', billingPeriodEnd: '', previousReading: '0', currentReading: '0', billAmount: '', dueDate: todayStr(), notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'electricityBills'), orderBy('dueDate', 'desc')))
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ElectricityBill))
    } catch { toast.error('Failed to load') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const units = Math.max(0, Number(form.currentReading) - Number(form.previousReading))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.billAmount || !form.dueDate) return toast.error('Amount and due date required')
    try {
      await addDoc(collection(db, 'electricityBills'), {
        ...form,
        previousReading: Number(form.previousReading), currentReading: Number(form.currentReading),
        unitsConsumed: units, billAmount: Number(form.billAmount),
        status: 'pending', createdBy: user!.uid, createdAt: serverTimestamp(),
      })
      toast.success('Bill added'); setShowForm(false); load()
    } catch (err: any) { toast.error(err.message) }
  }

  async function markPaid(bill: ElectricityBill) {
    try {
      await updateDoc(doc(db, 'electricityBills', bill.id), { status: 'paid', paymentDate: todayStr(), paymentMode: 'cash', updatedAt: serverTimestamp() })
      toast.success('Bill marked as paid'); load()
    } catch (err: any) { toast.error(err.message) }
  }

  const pending = bills.filter(b => b.status === 'pending')
  const totalPending = pending.reduce((s, b) => s + (b.billAmount || 0), 0)

  const statusColor: Record<string, string> = { pending: 'badge-warning', paid: 'badge-success', overdue: 'badge-danger' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Electricity Bills</h1><p className="page-subtitle">{pending.length} pending · {formatCurrency(totalPending)} due</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add Bill</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Bill Date</th><th>Period</th><th>Units</th><th>Amount</th><th>Due Date</th><th>Payment Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-10"><div className="spinner mx-auto" /></td></tr>
                : bills.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><Zap size={40} className="opacity-30 mb-3" /><p>No electricity bills recorded</p></div></td></tr>
                  : bills.map(b => (
                    <tr key={b.id}>
                      <td>{formatDate(b.billDate)}</td>
                      <td className="text-xs">{b.billingPeriodStart ? `${formatDate(b.billingPeriodStart)} – ${formatDate(b.billingPeriodEnd || '')}` : '—'}</td>
                      <td>{b.unitsConsumed || 0} kWh</td>
                      <td className="font-bold text-amber-300">{formatCurrency(b.billAmount)}</td>
                      <td className={new Date(b.dueDate) < new Date() && b.status === 'pending' ? 'text-red-400 font-semibold' : ''}>{formatDate(b.dueDate)}</td>
                      <td>{b.paymentDate ? formatDate(b.paymentDate) : '—'}</td>
                      <td><span className={`badge ${statusColor[b.status] || 'badge-muted'}`}>{b.status}</span></td>
                      <td>{b.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => markPaid(b)}>Pay</button>}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Add Electricity Bill</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Consumer Number</label><input className="form-input" value={form.consumerNumber} onChange={e => set('consumerNumber', e.target.value)} /></div>
                  <div><label className="form-label">Meter Number</label><input className="form-input" value={form.meterNumber} onChange={e => set('meterNumber', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Bill Date</label><input type="date" className="form-input" value={form.billDate} onChange={e => set('billDate', e.target.value)} /></div>
                  <div><label className="form-label">Due Date *</label><input type="date" className="form-input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} required /></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Period Start</label><input type="date" className="form-input" value={form.billingPeriodStart} onChange={e => set('billingPeriodStart', e.target.value)} /></div>
                  <div><label className="form-label">Period End</label><input type="date" className="form-input" value={form.billingPeriodEnd} onChange={e => set('billingPeriodEnd', e.target.value)} /></div>
                </div>
                <div className="form-row-3">
                  <div><label className="form-label">Previous Reading</label><input type="number" className="form-input" value={form.previousReading} onChange={e => set('previousReading', e.target.value)} /></div>
                  <div><label className="form-label">Current Reading</label><input type="number" className="form-input" value={form.currentReading} onChange={e => set('currentReading', e.target.value)} /></div>
                  <div><label className="form-label">Units</label><input className="form-input bg-white/[0.02] text-violet-300 font-bold" value={units} readOnly /></div>
                </div>
                <div><label className="form-label">Bill Amount (₹) *</label><input type="number" className="form-input" value={form.billAmount} onChange={e => set('billAmount', e.target.value)} required min="0" step="0.01" /></div>
                <div><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
