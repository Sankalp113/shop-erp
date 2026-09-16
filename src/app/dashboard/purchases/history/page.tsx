'use client'
import { useState, useEffect } from 'react'
import { collection, query, orderBy, where, onSnapshot, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { savePurchaseTransaction } from '@/lib/firebase/transactions'
import { Plus, X, Truck } from 'lucide-react'

export default function PurchaseHistoryPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [purchases, setPurchases] = useState<any[]>([])
  const [vendors, setVendors]     = useState<any[]>([])
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({
    purchaseDate: todayStr(), vendorId: '', vendorInvoiceNumber: '',
    dueDate: '', paymentMode: 'credit', notes: '',
  })
  const [items, setItems] = useState([{ productId: '', productName: '', qty: 1, unitPrice: 0, totalPrice: 0 }])

  // Live purchases listener
  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'purchases'), orderBy('purchaseDate', 'desc'))
    const unsub = onSnapshot(q,
      snap => { setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return () => unsub()
  }, [])

  // Load reference data (vendors + products — static lookups)
  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'vendors'), orderBy('name'))),
      getDocs(query(collection(db, 'products'), orderBy('name'))),
    ]).then(([vSnap, prSnap]) => {
      setVendors(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setProducts(prSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(() => {})
  }, [])

  function setItem(idx: number, key: string, val: any) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [key]: val }
      if (key === 'productId') {
        const p = products.find(p => p.id === val)
        updated.productName = p?.name || ''
        updated.unitPrice   = p?.purchasePrice || 0
        updated.totalPrice  = (updated.qty || 1) * (p?.purchasePrice || 0)
      }
      if (key === 'qty' || key === 'unitPrice') {
        updated.totalPrice = (Number(updated.qty) || 0) * (Number(updated.unitPrice) || 0)
      }
      return updated
    }))
  }

  const grandTotal = items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vendorId) return toast.error('Select a vendor')
    if (items.some(i => !i.productId)) return toast.error('Select product for all items')
    const vendor     = vendors.find(v => v.id === form.vendorId)
    const paidAmount = form.paymentMode !== 'credit' ? grandTotal : 0
    const countSnap  = await getDocs(collection(db, 'purchases'))
    const purchaseNumber = `PUR${String(countSnap.size + 1).padStart(5, '0')}`
    setSaving(true)
    try {
      await savePurchaseTransaction(
        {
          purchaseNumber,
          vendorId: form.vendorId,
          vendorName: vendor?.name || '',
          vendorInvoiceNumber: form.vendorInvoiceNumber || null,
          purchaseDate: form.purchaseDate,
          dueDate: form.dueDate || null,
          totalAmount: grandTotal,
          paidAmount,
          paymentMode: form.paymentMode,
          notes: form.notes || null,
          status: form.paymentMode === 'credit' ? 'pending' : 'paid',
          items: items.map(i => ({ productId: i.productId, quantity: i.qty, purchasePrice: i.unitPrice })),
        },
        user!.uid,
        user!.email || 'Staff'
      )
      toast.success(`Purchase ${purchaseNumber} saved — stock, vendor ledger, and reports updated.`)
      setShowForm(false)
      setItems([{ productId: '', productName: '', qty: 1, unitPrice: 0, totalPrice: 0 }])
      setForm({ purchaseDate: todayStr(), vendorId: '', vendorInvoiceNumber: '', dueDate: '', paymentMode: 'credit', notes: '' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to save purchase')
    }
    setSaving(false)
  }

  const total       = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0)
  const outstanding = purchases.reduce((s, p) => s + (p.outstandingAmount || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Purchase History</h1>
          <p className="page-subtitle flex items-center gap-2">
            {purchases.length} purchases · Outstanding: {formatCurrency(outstanding)}
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Live
            </span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16}/> New Purchase
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Purchase #</th><th>Date</th><th>Vendor</th>
                <th>Mode</th><th className="text-right">Total</th>
                <th className="text-right">Outstanding</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
                : purchases.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><Truck size={40} className="opacity-30 mb-3"/><p>No purchases yet</p></div></td></tr>
                : purchases.map(p => (
                  <tr key={p.id}>
                    <td><span className="font-mono font-bold text-violet-300">{p.purchaseNumber}</span></td>
                    <td>{formatDate(p.purchaseDate)}</td>
                    <td>{p.vendorName || '—'}</td>
                    <td className="capitalize">{p.paymentMode || '—'}</td>
                    <td className="text-right font-bold text-gray-200">{formatCurrency(p.totalAmount)}</td>
                    <td className={`text-right font-bold ${(p.outstandingAmount || 0) > 0 ? 'text-amber-300' : 'text-gray-600'}`}>
                      {formatCurrency(p.outstandingAmount || 0)}
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'paid' ? 'badge-success' : p.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">New Purchase</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18}/></button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Vendor *</label>
                    <select className="form-select" value={form.vendorId}
                      onChange={e => setForm(p => ({ ...p, vendorId: e.target.value }))} required>
                      <option value="">Select Vendor</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div><label className="form-label">Vendor Invoice No.</label>
                    <input className="form-input" value={form.vendorInvoiceNumber}
                      onChange={e => setForm(p => ({ ...p, vendorInvoiceNumber: e.target.value }))}/>
                  </div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Purchase Date</label>
                    <input type="date" className="form-input" value={form.purchaseDate}
                      onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))}/>
                  </div>
                  <div><label className="form-label">Due Date</label>
                    <input type="date" className="form-input" value={form.dueDate}
                      onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}/>
                  </div>
                </div>
                <div><label className="form-label">Payment Mode</label>
                  <select className="form-select w-auto" value={form.paymentMode}
                    onChange={e => setForm(p => ({ ...p, paymentMode: e.target.value }))}>
                    <option value="credit">Credit (Pay Later)</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label">Items</label>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setItems(p => [...p, { productId: '', productName: '', qty: 1, unitPrice: 0, totalPrice: 0 }])}>
                      + Add Row
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <select className="form-select" value={it.productId}
                            onChange={e => setItem(idx, 'productId', e.target.value)}>
                            <option value="">Select Product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input type="number" className="form-input" placeholder="Qty"
                            value={it.qty} onChange={e => setItem(idx, 'qty', e.target.value)} min="1"/>
                        </div>
                        <div className="col-span-2">
                          <input type="number" className="form-input" placeholder="Price"
                            value={it.unitPrice} onChange={e => setItem(idx, 'unitPrice', e.target.value)} min="0" step="0.01"/>
                        </div>
                        <div className="col-span-2 text-right font-semibold text-gray-300">{formatCurrency(it.totalPrice)}</div>
                        <div className="col-span-1">
                          <button type="button" className="btn btn-ghost btn-icon text-red-400"
                            onClick={() => setItems(p => p.filter((_, i) => i !== idx))}><X size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-right mt-3 font-bold text-lg text-violet-300">Total: {formatCurrency(grandTotal)}</div>
                </div>
                <div><label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><div className="spinner w-4 h-4"/> Saving…</> : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
