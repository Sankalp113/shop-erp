'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Home, CheckCircle } from 'lucide-react'
import type { RentPayment } from '@/types'

export default function RentPage() {
  const { user } = useAuth()
  const [rents, setRents] = useState<RentPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rentType: 'monthly' as RentPayment['rentType'], periodStart: todayStr(), amount: '', dueDate: todayStr(), landlordName: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db,'rentPayments'), orderBy('dueDate','desc')))
      setRents(snap.docs.map(d=>({id:d.id,...d.data()}) as RentPayment))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(()=>{load()},[load])
  const set = (k:string,v:any)=>setForm(p=>({...p,[k]:v}))

  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.dueDate) return toast.error('Amount and due date required')
    try {
      await addDoc(collection(db,'rentPayments'), { ...form, amount: Number(form.amount), status: 'pending', createdBy: user!.uid, createdAt: serverTimestamp() })
      toast.success('Rent record added'); setShowForm(false); load()
    } catch (err:any) { toast.error(err.message) }
  }

  async function markPaid(rent: RentPayment) {
    try {
      await updateDoc(doc(db,'rentPayments',rent.id), { status: 'paid', paymentDate: todayStr(), paymentMode: 'cash', updatedAt: serverTimestamp() })
      toast.success('Rent marked as paid'); load()
    } catch {}
  }

  const pending = rents.filter(r=>r.status==='pending')
  const totalPending = pending.reduce((s,r)=>s+(r.amount||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Shop Rent</h1><p className="page-subtitle">{pending.length} pending · {formatCurrency(totalPending)} due</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Add Rent</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Type</th><th>Landlord</th><th>Amount</th><th>Due Date</th><th>Payment Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={8} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
              :rents.length===0?<tr><td colSpan={8}><div className="empty-state"><Home size={40} className="opacity-30 mb-3"/><p>No rent records</p></div></td></tr>
              :rents.map(r=>(
                <tr key={r.id}>
                  <td>{formatDate(r.periodStart)}</td>
                  <td className="capitalize">{r.rentType}</td>
                  <td>{r.landlordName||'—'}</td>
                  <td className="font-bold text-amber-300">{formatCurrency(r.amount)}</td>
                  <td className={new Date(r.dueDate)<new Date()&&r.status==='pending'?'text-red-400 font-semibold':''}>{formatDate(r.dueDate)}</td>
                  <td>{r.paymentDate?formatDate(r.paymentDate):'—'}</td>
                  <td><span className={`badge ${r.status==='paid'?'badge-success':'badge-warning'}`}>{r.status}</span></td>
                  <td>{r.status!=='paid'&&<button className="btn btn-success btn-sm" onClick={()=>markPaid(r)}><CheckCircle size={13}/> Pay</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Add Rent Record</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Rent Type</label>
                    <select className="form-select" value={form.rentType} onChange={e=>set('rentType',e.target.value)}>
                      <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                    </select>
                  </div>
                  <div><label className="form-label">Period Start</label><input type="date" className="form-input" value={form.periodStart} onChange={e=>set('periodStart',e.target.value)}/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Amount (₹) *</label><input type="number" className="form-input" value={form.amount} onChange={e=>set('amount',e.target.value)} required min="0"/></div>
                  <div><label className="form-label">Due Date *</label><input type="date" className="form-input" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)} required/></div>
                </div>
                <div><label className="form-label">Landlord Name</label><input className="form-input" value={form.landlordName} onChange={e=>set('landlordName',e.target.value)}/></div>
                <div><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
