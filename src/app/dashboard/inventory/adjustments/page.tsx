'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr } from '@/lib/utils'
import { Package, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'

export default function StockAdjustmentsPage() {
  const { user } = useAuth()
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ productId:'', adjustmentDate: todayStr(), adjustmentType:'add', quantity:'', reason:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db,'stockTransactions'), where('transactionType','in',['adjustment_add','adjustment_remove']), orderBy('createdAt','desc'))),
        getDocs(query(collection(db,'products'), where('isActive','==',true), orderBy('name'))),
      ])
      setAdjustments(aSnap.docs.map(d=>({id:d.id,...d.data()})))
      setProducts(pSnap.docs.map(d=>({id:d.id,...d.data()})))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(()=>{ load() },[load])
  const set = (k:string,v:any)=>setForm(p=>({...p,[k]:v}))

  async function submit(e:React.FormEvent) {
    e.preventDefault()
    if (!form.productId || !form.quantity) return toast.error('Product and quantity required')
    const product = products.find(p=>p.id===form.productId)
    const qty = Number(form.quantity)
    const type = form.adjustmentType==='add'?'adjustment_add':'adjustment_remove'
    try {
      await addDoc(collection(db,'stockTransactions'), {
        productId: form.productId, productName: product?.name||'',
        transactionType: type, quantity: qty,
        adjustmentReason: form.reason, notes: form.notes||null,
        adjustmentDate: form.adjustmentDate,
        createdBy: user!.uid, createdAt: serverTimestamp(),
      })
      // Update product stock
      const newStock = form.adjustmentType==='add' ? (product?.currentStock||0)+qty : Math.max(0,(product?.currentStock||0)-qty)
      await updateDoc(doc(db,'products',form.productId),{currentStock: newStock, updatedAt: serverTimestamp()})
      toast.success(`Stock ${form.adjustmentType==='add'?'added':'removed'}: ${qty} units`)
      setShowForm(false); load()
    } catch (err:any) { toast.error(err.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Stock Adjustments</h1><p className="page-subtitle">Manual stock corrections and write-offs</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Adjust Stock</button>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={5} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
              :adjustments.length===0?<tr><td colSpan={5}><div className="empty-state"><Package size={40} className="opacity-30 mb-3"/><p>No adjustments yet</p></div></td></tr>
              :adjustments.map(a=>(
                <tr key={a.id}>
                  <td>{formatDate(a.adjustmentDate||'')}</td>
                  <td className="font-medium text-gray-200">{a.productName}</td>
                  <td><span className={`badge ${a.transactionType==='adjustment_add'?'badge-success':'badge-danger'} flex items-center gap-1 w-fit`}>{a.transactionType==='adjustment_add'?<ArrowUp size={10}/>:<ArrowDown size={10}/>}{a.transactionType==='adjustment_add'?'Added':'Removed'}</span></td>
                  <td className={`font-bold ${a.transactionType==='adjustment_add'?'text-emerald-300':'text-red-300'}`}>{a.transactionType==='adjustment_add'?'+':'-'}{a.quantity}</td>
                  <td className="text-gray-500">{a.adjustmentReason||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Stock Adjustment</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div><label className="form-label">Product *</label>
                  <select className="form-select" value={form.productId} onChange={e=>set('productId',e.target.value)} required>
                    <option value="">Select Product</option>
                    {products.map(p=><option key={p.id} value={p.id}>{p.name} (Current: {p.currentStock||0})</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Adjustment Type</label>
                    <select className="form-select" value={form.adjustmentType} onChange={e=>set('adjustmentType',e.target.value)}>
                      <option value="add">➕ Add Stock</option>
                      <option value="remove">➖ Remove Stock</option>
                    </select>
                  </div>
                  <div><label className="form-label">Quantity *</label><input type="number" className="form-input" value={form.quantity} onChange={e=>set('quantity',e.target.value)} required min="1"/></div>
                </div>
                <div><label className="form-label">Reason</label>
                  <select className="form-select" value={form.reason} onChange={e=>set('reason',e.target.value)}>
                    <option value="">Select reason</option>
                    <option value="physical_count">Physical Count Correction</option>
                    <option value="damaged">Damaged / Expired</option>
                    <option value="theft">Theft / Loss</option>
                    <option value="returned_to_vendor">Returned to Vendor</option>
                    <option value="free_sample">Free Sample / Gift</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
