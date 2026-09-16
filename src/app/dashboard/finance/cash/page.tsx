'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Wallet } from 'lucide-react'

const TRANSACTION_TYPES = ['opening','sale','purchase_payment','expense','salary','rent','electricity','other_in','other_out'] as const

export default function CashBookPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<any[]>([])
  const [cashBalance, setCashBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ transactionDate: todayStr(), transactionType: 'other_in', description: '', amount: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tSnap, balSnap] = await Promise.all([
        getDocs(query(collection(db,'cashTransactions'), where('transactionDate','>=',`${month}-01`), where('transactionDate','<=',`${month}-31`), orderBy('transactionDate','desc'))),
        getDoc(doc(db,'settings','cashBalance')),
      ])
      setTransactions(tSnap.docs.map(d=>({id:d.id,...d.data()})))
      setCashBalance(balSnap.exists() ? Number(balSnap.data().value)||0 : 0)
    } catch {}
    setLoading(false)
  }, [month])

  useEffect(()=>{load()},[load])
  const set = (k:string,v:any)=>setForm(p=>({...p,[k]:v}))

  const isInflow = (type: string) => ['opening','sale','other_in'].includes(type)

  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.amount) return toast.error('Description and amount required')
    const amt = Number(form.amount)
    const isIn = isInflow(form.transactionType)
    const newBalance = isIn ? cashBalance + amt : cashBalance - amt
    try {
      await addDoc(collection(db,'cashTransactions'), {
        ...form, amount: amt, balanceAfter: newBalance,
        createdBy: user!.uid, createdAt: serverTimestamp(),
      })
      await setDoc(doc(db,'settings','cashBalance'), { value: String(newBalance) }, { merge: true })
      setCashBalance(newBalance)
      toast.success('Transaction recorded')
      setShowForm(false)
      setForm({ transactionDate:todayStr(), transactionType:'other_in', description:'', amount:'', notes:'' })
      load()
    } catch (err:any) { toast.error(err.message) }
  }

  const totalIn = transactions.filter(t=>isInflow(t.transactionType)).reduce((s,t)=>s+(t.amount||0),0)
  const totalOut = transactions.filter(t=>!isInflow(t.transactionType)).reduce((s,t)=>s+(t.amount||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Cash Book</h1><p className="page-subtitle">Current Balance: <span className={`font-bold ${cashBalance>=0?'text-emerald-400':'text-red-400'}`}>{formatCurrency(cashBalance)}</span></p></div>
        <div className="flex gap-2">
          <input type="month" className="form-input w-auto" value={month} onChange={e=>setMonth(e.target.value)}/>
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Entry</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="kpi-card" style={{'--kpi-accent':'#10B981'} as any}><p className="text-xs text-gray-500 uppercase">Total Inflow</p><p className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(totalIn)}</p></div>
        <div className="kpi-card" style={{'--kpi-accent':'#EF4444'} as any}><p className="text-xs text-gray-500 uppercase">Total Outflow</p><p className="text-xl font-bold text-red-300 mt-1">{formatCurrency(totalOut)}</p></div>
        <div className="kpi-card" style={{'--kpi-accent':'#7C3AED'} as any}><p className="text-xs text-gray-500 uppercase">Net</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(totalIn-totalOut)}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-right">In (₹)</th><th className="text-right">Out (₹)</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={6} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
              :transactions.length===0?<tr><td colSpan={6}><div className="empty-state"><Wallet size={40} className="opacity-30 mb-3"/><p>No transactions this month</p></div></td></tr>
              :transactions.map(t=>{
                const inflow = isInflow(t.transactionType)
                return (
                  <tr key={t.id}>
                    <td>{formatDate(t.transactionDate)}</td>
                    <td><span className="badge badge-muted text-xs capitalize">{t.transactionType.replace('_',' ')}</span></td>
                    <td className="text-gray-200">{t.description}</td>
                    <td className="text-right font-semibold text-emerald-300">{inflow?formatCurrency(t.amount):'—'}</td>
                    <td className="text-right font-semibold text-red-300">{!inflow?formatCurrency(t.amount):'—'}</td>
                    <td className={`text-right font-bold ${(t.balanceAfter||0)>=0?'text-gray-200':'text-red-400'}`}>{formatCurrency(t.balanceAfter||0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Cash Entry</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Date</label><input type="date" className="form-input" value={form.transactionDate} onChange={e=>set('transactionDate',e.target.value)}/></div>
                  <div><label className="form-label">Type</label>
                    <select className="form-select" value={form.transactionType} onChange={e=>set('transactionType',e.target.value)}>
                      <option value="other_in">💚 Cash In (Other)</option>
                      <option value="sale">💚 Sale Received</option>
                      <option value="opening">💚 Opening Balance</option>
                      <option value="expense">❌ Expense</option>
                      <option value="purchase_payment">❌ Purchase Payment</option>
                      <option value="salary">❌ Salary Paid</option>
                      <option value="rent">❌ Rent Paid</option>
                      <option value="electricity">❌ Electricity</option>
                      <option value="other_out">❌ Cash Out (Other)</option>
                    </select>
                  </div>
                </div>
                <div><label className="form-label">Description *</label><input className="form-input" value={form.description} onChange={e=>set('description',e.target.value)} required/></div>
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input type="number" className="form-input" value={form.amount} onChange={e=>set('amount',e.target.value)} required min="0" step="0.01"/>
                  {form.amount && <p className="text-xs mt-1" style={{color: isInflow(form.transactionType)?'#10B981':'#EF4444'}}>Balance after: {formatCurrency(isInflow(form.transactionType)?cashBalance+Number(form.amount):cashBalance-Number(form.amount))}</p>}
                </div>
                <div><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
