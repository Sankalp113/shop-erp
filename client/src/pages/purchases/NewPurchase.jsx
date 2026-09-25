import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getVendors, getProducts, createPurchase } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function NewPurchase() {
  const { user } = useAuth()
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ vendor_id: '', vendor_invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], due_date: '', payment_mode: 'cash', paid_amount: 0, discount_amount: 0, notes: '' })
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getVendors({ limit: 200 }).then(r => setVendors(r.data))
    loadProducts()
  }, [])
  useEffect(() => { loadProducts() }, [search])
  async function loadProducts() {
    const r = await getProducts({ search, limit: 100 })
    setProducts(r.data)
  }
  function addItem(product) {
    setItems(prev => {
      const ex = prev.find(i => i.product_id === product.id)
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.purchase_price, discount_percent: 0, tax_percent: product.tax_percent || 0 }]
    })
  }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function setItemField(idx, k, v) { setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it)) }

  const itemTotals = items.map(it => {
    const gross = it.unit_price * it.quantity
    const disc = gross * (it.discount_percent || 0) / 100
    const net = gross - disc
    const tax = net * (it.tax_percent || 0) / 100
    return { gross, disc, net, tax, total: net + tax }
  })
  const subtotal      = itemTotals.reduce((s, t) => s + t.gross, 0)
  const itemDiscTotal = itemTotals.reduce((s, t) => s + t.disc, 0)
  const totalTax      = itemTotals.reduce((s, t) => s + t.tax, 0)
  const grandTotal    = subtotal - itemDiscTotal - Number(form.discount_amount) + totalTax
  const outstanding   = grandTotal - Number(form.paid_amount)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (items.length === 0) return toast.error('Add items to purchase')
    setSubmitting(true)
    try {
      const vendorObj = vendors.find(v => v.id === form.vendor_id)
      const res = await createPurchase({ ...form, vendor_name: vendorObj?.name || '', items, paid_amount: Number(form.paid_amount), discount_amount: Number(form.discount_amount) }, user?.uid)
      toast.success(`✅ Purchase ${res.purchase_number} created`)
      setItems([]); setForm({ vendor_id: '', vendor_invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], due_date: '', payment_mode: 'cash', paid_amount: 0, discount_amount: 0, notes: '' })
    } catch (err) { toast.error(err.message || 'Failed') } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="page-header"><h1>🚚 New Purchase</h1><p>Record purchase from vendor — stock will be updated automatically</p></div>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
          {/* Product Search */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><span className="card-title">Select Products</span></div>
              <div className="card-body">
                <input className="form-control" placeholder="🔍 Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {products.slice(0, 30).map(p => (
                    <div key={p.id} className="product-card" onClick={() => addItem(p)} style={{ padding: 10 }}>
                      <div className="product-card-name" style={{ fontSize: 11 }}>{p.name}</div>
                      <div className="product-card-price" style={{ fontSize: 13 }}>{fmt(p.purchase_price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Items Table */}
            {items.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">Purchase Items</span></div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="table">
                    <thead><tr><th>Product</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Disc%</th><th style={{ textAlign: 'right' }}>Total</th><th></th></tr></thead>
                    <tbody>{items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                        <td style={{ textAlign: 'center' }}><input type="number" value={item.quantity} min="1" onChange={e => setItemField(idx, 'quantity', Number(e.target.value))} style={{ width: 60, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'center' }} /></td>
                        <td style={{ textAlign: 'right' }}><input type="number" value={item.unit_price} min="0" step="0.01" onChange={e => setItemField(idx, 'unit_price', Number(e.target.value))} style={{ width: 90, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'right' }} /></td>
                        <td style={{ textAlign: 'right' }}><input type="number" value={item.discount_percent} min="0" max="100" onChange={e => setItemField(idx, 'discount_percent', Number(e.target.value))} style={{ width: 60, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'right' }} /></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(itemTotals[idx]?.gross)}</td>

                        <td><button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(idx)}>✕</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Details & Payment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Purchase Details</span></div>
              <div className="card-body">
                <div className="form-group"><label className="form-label">Vendor</label>
                  <select className="form-control" value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}>
                    <option value="">Walk-in / Unknown</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Vendor Invoice #</label>
                  <input className="form-control" value={form.vendor_invoice_number} onChange={e => set('vendor_invoice_number', e.target.value)} placeholder="Vendor's invoice number" /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Purchase Date</label>
                    <input type="date" className="form-control" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Due Date</label>
                    <input type="date" className="form-control" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Payment</span></div>
              <div className="card-body">
                <div className="pos-total-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {itemDiscTotal > 0 && (
                  <div className="pos-total-row" style={{color:'var(--warning)'}}><span>Item Discounts</span><span>-{fmt(itemDiscTotal)}</span></div>
                )}
                <div className="form-group"><label className="form-label">Bill Discount (₹)</label>
                  <input type="number" className="form-control" value={form.discount_amount} onChange={e => set('discount_amount', e.target.value)} min="0" /></div>
                {totalTax > 0 && <div className="pos-total-row"><span>Tax (GST)</span><span>+{fmt(totalTax)}</span></div>}
                <div className="pos-total-final"><span>Total</span><span>{fmt(grandTotal)}</span></div>

                <div className="form-group"><label className="form-label">Payment Mode</label>
                  <select className="form-control" value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card/Cheque</option><option value="bank">Bank Transfer</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Paid Amount</label>
                  <input type="number" className="form-control" value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} min="0" max={grandTotal} /></div>
                {outstanding > 0 && <div style={{ color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>Outstanding: {fmt(outstanding)}</div>}
                <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
                <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: 14, marginTop: 8 }} disabled={submitting || items.length === 0}>
                  {submitting ? '⏳ Saving...' : `✅ Create Purchase — ${fmt(grandTotal)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
