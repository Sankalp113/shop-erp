'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Landmark } from 'lucide-react'

export default function BankAccountsPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ accountName:'', bankName:'', accountNumber:'', ifscCode:'', currentBalance:'0', openingBalance:'0' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db,'bankAccounts'), orderBy('accountName')))
      setAccounts(snap.docs.map(d=>({id:d.id,...d.data()})))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(()=>{ load() },[load])
  const set = (k:string,v:any)=>setForm(p=>({...p,[k]:v}))

  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (!form.accountName || !form.bankName) return toast.error('Account name and bank required')
    try {
      await addDoc(collection(db,'bankAccounts'), { ...form, currentBalance: Number(form.currentBalance)||0, openingBalance: Number(form.openingBalance)||0, isActive: true, createdBy: user!.uid, createdAt: serverTimestamp() })
      toast.success('Bank account added'); setShowForm(false); load()
    } catch (err:any) { toast.error(err.message) }
  }

  const total = accounts.reduce((s,a)=>s+(a.currentBalance||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Bank Accounts</h1><p className="page-subtitle">Total: {formatCurrency(total)}</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Add Account</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        {accounts.map(a=>(
          <div key={a.id} className="glass-card p-5" style={{'--kpi-accent':'#06B6D4'} as any}>
            <div className="flex items-start justify-between mb-3">
              <div><div className="font-bold text-gray-200">{a.accountName}</div><div className="text-xs text-gray-500">{a.bankName}</div></div>
              <Landmark size={20} className="text-cyan-400"/>
            </div>
            <div className="text-2xl font-bold text-white">{formatCurrency(a.currentBalance||0)}</div>
            <div className="text-xs text-gray-600 mt-1 font-mono">{a.accountNumber||'****'} · {a.ifscCode||'—'}</div>
          </div>
        ))}
        {!loading && accounts.length===0 && <div className="empty-state col-span-3 py-12"><Landmark size={40} className="opacity-30 mb-3"/><p>No bank accounts added</p></div>}
      </div>
      {showForm&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Add Bank Account</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Account Name *</label><input className="form-input" value={form.accountName} onChange={e=>set('accountName',e.target.value)} required/></div>
                  <div><label className="form-label">Bank Name *</label><input className="form-input" value={form.bankName} onChange={e=>set('bankName',e.target.value)} required/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Account Number</label><input className="form-input" value={form.accountNumber} onChange={e=>set('accountNumber',e.target.value)}/></div>
                  <div><label className="form-label">IFSC Code</label><input className="form-input" value={form.ifscCode} onChange={e=>set('ifscCode',e.target.value.toUpperCase())}/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Opening Balance (₹)</label><input type="number" className="form-input" value={form.openingBalance} onChange={e=>set('openingBalance',e.target.value)} min="0" step="0.01"/></div>
                  <div><label className="form-label">Current Balance (₹)</label><input type="number" className="form-input" value={form.currentBalance} onChange={e=>set('currentBalance',e.target.value)} step="0.01"/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
