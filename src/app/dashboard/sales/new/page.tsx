'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, orderBy, getDocs, addDoc, runTransaction, doc, increment, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, todayStr } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CheckCircle, User } from 'lucide-react'
import type { Product, Customer, SaleItem } from '@/types'

export default function NewSalePage() {
  const { user, profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [cartItems, setCartItems] = useState<SaleItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [paymentMode, setPaymentMode] = useState<'cash'|'upi'|'card'|'credit'|'split'>('cash')
  const [cashAmt, setCashAmt] = useState('')
  const [upiAmt, setUpiAmt] = useState('')
  const [cardAmt, setCardAmt] = useState('')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [pSnap, cSnap] = await Promise.all([
        getDocs(query(collection(db,'products'), orderBy('name'))),
        getDocs(query(collection(db,'customers'), orderBy('name'))),
      ])
      setProducts(pSnap.docs.map(d=>({id:d.id,...d.data()}) as Product))
      setCustomers(cSnap.docs.map(d=>({id:d.id,...d.data()}) as Customer))
    } catch {}
  }, [])

  useEffect(() => { load(); searchRef.current?.focus() }, [load])

  const filteredProducts = products.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
  }).slice(0, 30)

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.mobile?.includes(q)
  }).slice(0, 8)

  function addToCart(product: Product) {
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === product.id && !i.variantId)
      if (existing) return prev.map(i => i.productId === product.id && !i.variantId ? { ...i, qty: i.qty + 1, totalPrice: (i.qty+1)*i.unitPrice } : i)
      const discAmt = (product.sellingPrice * (product.discountPercent||0)) / 100
      const price = product.sellingPrice - discAmt
      const taxAmt = (price * (product.taxRate||0)) / 100
      return [...prev, {
        productId: product.id, productName: product.name,
        qty: 1, unitPrice: product.sellingPrice,
        discountPercent: product.discountPercent||0, discountAmount: discAmt,
        taxPercent: product.taxRate||0, taxAmount: taxAmt,
        totalPrice: price + taxAmt, purchasePrice: product.purchasePrice||0,
      }]
    })
    setSearch('')
    searchRef.current?.focus()
  }

  function updateQty(idx: number, delta: number) {
    setCartItems(prev => {
      const item = prev[idx]
      const newQty = Math.max(1, item.qty + delta)
      return prev.map((i,j) => j===idx ? {...i, qty: newQty, totalPrice: newQty*(i.unitPrice-i.discountAmount+i.taxAmount)} : i)
    })
  }

  function removeItem(idx: number) { setCartItems(p => p.filter((_,j) => j!==idx)) }

  const subtotal = cartItems.reduce((s,i) => s + i.qty*i.unitPrice, 0)
  const totalDiscount = cartItems.reduce((s,i) => s + i.qty*i.discountAmount, 0) + Number(discount||0)
  const totalTax = cartItems.reduce((s,i) => s + i.qty*i.taxAmount, 0)
  const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax)

  const paidAmount = paymentMode === 'split'
    ? (Number(cashAmt)||0) + (Number(upiAmt)||0) + (Number(cardAmt)||0)
    : paymentMode === 'credit' ? 0 : grandTotal

  async function completeSale() {
    if (cartItems.length === 0) return toast.error('Add items to the bill')
    if (paymentMode === 'split' && paidAmount < grandTotal) return toast.error(`Split total ₹${paidAmount} < Bill total ₹${grandTotal.toFixed(0)}`)
    setSaving(true)
    try {
      const today = todayStr()
      // Get next invoice number
      const settingRef = doc(db, 'settings', 'invoiceCounter')
      let invoiceNumber = ''
      await runTransaction(db, async (tx) => {
        const setting = await tx.get(settingRef)
        const prefix = 'INV'
        const counter = setting.exists() ? (Number(setting.data().value)||0) + 1 : 1
        invoiceNumber = `${prefix}${String(counter).padStart(5,'0')}`
        tx.set(settingRef, { value: String(counter) }, { merge: true })
      })

      const saleData = {
        invoiceNumber, saleDate: today,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerMobile: selectedCustomer?.mobile || null,
        subtotal, discountAmount: totalDiscount, taxAmount: totalTax, totalAmount: grandTotal,
        paidAmount, creditAmount: paymentMode==='credit' ? grandTotal : 0,
        paymentMode,
        cashAmount: paymentMode==='cash' ? grandTotal : (Number(cashAmt)||0),
        upiAmount: paymentMode==='upi' ? grandTotal : (Number(upiAmt)||0),
        cardAmount: paymentMode==='card' ? grandTotal : (Number(cardAmt)||0),
        notes: notes || null,
        status: 'completed',
        createdBy: user!.uid,
        totalCost: cartItems.reduce((s,i) => s + i.qty*(i.purchasePrice||0), 0),
        createdAt: serverTimestamp(),
      }

      const saleRef = await addDoc(collection(db,'sales'), saleData)

      // Add items as subcollection
      await Promise.all(cartItems.map(item =>
        addDoc(collection(db,'sales',saleRef.id,'items'), item)
      ))

      // Update customer outstanding if credit
      if (selectedCustomer && paymentMode === 'credit') {
        const custRef = doc(db,'customers',selectedCustomer.id)
        await runTransaction(db, async tx => {
          const cust = await tx.get(custRef)
          const cur = cust.data()?.outstanding || 0
          tx.update(custRef, { outstanding: cur + grandTotal, totalPurchases: (cust.data()?.totalPurchases||0)+grandTotal, lastPurchaseDate: today })
        })
      }

      setShowSuccess({ invoiceNumber, total: grandTotal })
      setCartItems([])
      setSelectedCustomer(null)
      setPaymentMode('cash')
      setCashAmt(''); setUpiAmt(''); setCardAmt('')
      setDiscount('0'); setNotes('')
      toast.success(`Bill ${invoiceNumber} created!`)
    } catch (err: any) { toast.error(err.message) }
    setSaving(false)
  }

  return (
    <div className="pos-layout">
      {/* Left: Product Search */}
      <div className="pos-products space-y-4">
        <div>
          <h1 className="page-title mb-3">🧾 New Bill (POS)</h1>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            <input ref={searchRef} className="form-input pl-10 text-base" placeholder="Search product by name or code…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
          </div>
        </div>

        {/* Customer Selection */}
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <User size={14} className="text-gray-500"/><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</span>
          </div>
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-200">{selectedCustomer.name}</div>
                <div className="text-xs text-gray-500">{selectedCustomer.mobile} · O/S: {formatCurrency(selectedCustomer.outstanding||0)}</div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>setSelectedCustomer(null)}><X size={14}/></button>
            </div>
          ) : (
            <div className="relative">
              <input className="form-input" placeholder="Search customer or skip for walk-in…" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)}/>
              {customerSearch && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 glass-card border border-white/10 z-10 max-h-48 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button key={c.id} className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors" onClick={()=>{setSelectedCustomer(c);setCustomerSearch('')}}>
                      <div className="text-sm text-gray-200">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.mobile}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map(p => (
            <button key={p.id} onClick={()=>addToCart(p)}
              className="glass-card p-3 text-left hover:bg-white/[0.07] hover:border-violet-500/30 transition-all active:scale-95">
              <div className="text-sm font-semibold text-gray-200 truncate">{p.name}</div>
              <div className="text-xs text-gray-600 truncate">{p.categoryName||p.code||''}</div>
              <div className="text-base font-bold text-violet-300 mt-2">{formatCurrency(p.sellingPrice)}</div>
              {p.taxRate > 0 && <div className="text-xs text-gray-600">+{p.taxRate}% GST</div>}
            </button>
          ))}
          {filteredProducts.length === 0 && search && (
            <div className="col-span-full text-center py-8 text-gray-600">No products found for "{search}"</div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="pos-cart">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-violet-400"/>
            <span className="font-bold text-sm">{cartItems.length} items</span>
          </div>
          {cartItems.length > 0 && <button className="btn btn-ghost btn-sm text-red-400" onClick={()=>setCartItems([])}><Trash2 size={13}/> Clear</button>}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {cartItems.length === 0 ? (
            <div className="empty-state py-12"><div className="empty-icon"><ShoppingCart size={32}/></div><p className="text-sm">Add products to the bill</p></div>
          ) : cartItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 py-2 border-b border-white/5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-200 truncate">{item.productName}</div>
                <div className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} {item.taxPercent>0?`+${item.taxPercent}%`:''}</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-6 h-6 rounded bg-white/5 flex items-center justify-center hover:bg-white/10" onClick={()=>updateQty(idx,-1)}><Minus size={12}/></button>
                <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                <button className="w-6 h-6 rounded bg-white/5 flex items-center justify-center hover:bg-white/10" onClick={()=>updateQty(idx,1)}><Plus size={12}/></button>
              </div>
              <div className="text-sm font-semibold text-gray-200 w-16 text-right">{formatCurrency(item.totalPrice*item.qty)}</div>
              <button className="text-gray-600 hover:text-red-400 transition-colors" onClick={()=>removeItem(idx)}><X size={14}/></button>
            </div>
          ))}
        </div>

        {/* Totals */}
        {cartItems.length > 0 && (
          <div className="border-t border-white/10 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-400">Extra Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">₹</span>
                <input className="w-20 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-right text-sm" value={discount} onChange={e=>setDiscount(e.target.value)}/>
              </div>
            </div>
            <div className="flex justify-between text-gray-400"><span>Tax (GST)</span><span>+{formatCurrency(totalTax)}</span></div>
            <div className="flex justify-between text-base font-bold text-white border-t border-white/10 pt-2"><span>TOTAL</span><span className="text-violet-300">{formatCurrency(grandTotal)}</span></div>
          </div>
        )}

        {/* Payment Mode */}
        {cartItems.length > 0 && (
          <div className="px-4 pb-2 space-y-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap gap-1.5">
              {(['cash','upi','card','credit','split'] as const).map(m => (
                <button key={m} onClick={()=>setPaymentMode(m)}
                  className={`btn btn-sm capitalize ${paymentMode===m?'btn-primary':'btn-secondary'}`}>{m}</button>
              ))}
            </div>
            {paymentMode === 'split' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><label className="form-label">Cash ₹</label><input className="form-input" value={cashAmt} onChange={e=>setCashAmt(e.target.value)} placeholder="0"/></div>
                <div><label className="form-label">UPI ₹</label><input className="form-input" value={upiAmt} onChange={e=>setUpiAmt(e.target.value)} placeholder="0"/></div>
                <div><label className="form-label">Card ₹</label><input className="form-input" value={cardAmt} onChange={e=>setCardAmt(e.target.value)} placeholder="0"/></div>
              </div>
            )}
            <textarea className="form-textarea text-xs" rows={1} placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)}/>
            <button className="btn btn-success w-full justify-center py-3 text-base" onClick={completeSale} disabled={saving}>
              {saving ? <><div className="spinner spinner-sm"/>Processing…</> : <>✅ Complete Bill · {formatCurrency(grandTotal)}</>}
            </button>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="modal-overlay">
          <div className="modal modal-sm text-center">
            <div className="modal-body py-8">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4"/>
              <h3 className="text-xl font-bold text-white mb-1">Bill Created!</h3>
              <p className="text-gray-400 text-sm mb-1">Invoice: <strong className="text-violet-300">{showSuccess.invoiceNumber}</strong></p>
              <p className="text-2xl font-bold text-white mt-3">{formatCurrency(showSuccess.total)}</p>
              <div className="flex gap-3 mt-6 justify-center">
                <button className="btn btn-secondary" onClick={()=>setShowSuccess(null)}>New Bill</button>
                <button className="btn btn-primary" onClick={()=>window.print()}>🖨️ Print</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
