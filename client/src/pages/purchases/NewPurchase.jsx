import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getVendors, getProducts, createPurchase } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from '../../context/AccountContext'

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function NewPurchase() {
  const { user } = useAuth()
  const { account } = useAccount()
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    vendor_id: '', vendor_invoice_number: '', bill_date: new Date().toISOString().split('T')[0],
    due_date: '', payment_mode: 'cash', paid_amount: 0, discount_amount: 0,
    transportation_charges: 0, other_charges: 0, gst_percent: 0, notes: ''
  })
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
      return [...prev, {
        product_id: product.id, product_name: product.name,
        quantity: 1, unit_price: product.purchase_price || 0,
        gst_percent: product.tax_percent || 0, unit: product.unit || 'Piece',
        discount_percent: 0
      }]
    })
  }

  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function setItemField(idx, k, v) { setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it)) }

  // Per-item calculations: basic_amount = qty × purchase_rate
  const itemTotals = items.map(it => {
    const basic_amount = Number(it.unit_price) * Number(it.quantity) // Basic = Qty × Rate
    const disc = basic_amount * (Number(it.discount_percent || 0) / 100)
    const netAfterDisc = basic_amount - disc
    const gst_amount = netAfterDisc * (Number(it.gst_percent || 0) / 100)
    return { basic_amount, disc, net: netAfterDisc, gst_amount, total: netAfterDisc + gst_amount }
  })

  const subtotal = itemTotals.reduce((s, t) => s + t.basic_amount, 0)
  const itemDiscTotal = itemTotals.reduce((s, t) => s + t.disc, 0)
  const totalGst = itemTotals.reduce((s, t) => s + t.gst_amount, 0)
  const transport = Number(form.transportation_charges || 0)
  const otherCharges = Number(form.other_charges || 0)
  const billDisc = Number(form.discount_amount || 0)

  // Total Bill = Basic + GST + Transportation + Other − Bill Discount
  const grandTotal = subtotal - itemDiscTotal - billDisc + totalGst + transport + otherCharges
  const outstanding = grandTotal - Number(form.paid_amount)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (items.length === 0) return toast.error('Add at least one product to the purchase')
    if (!form.vendor_id) return toast.error('Please select a vendor')
    setSubmitting(true)
    try {
      const vendorObj = vendors.find(v => v.id === form.vendor_id)
      const res = await createPurchase({
        vendor_id: form.vendor_id,
        vendor_name: vendorObj?.name || '',
        vendor_invoice_number: form.vendor_invoice_number,
        purchase_date: form.bill_date,
        due_date: form.due_date,
        payment_mode: form.payment_mode,
        paid_amount: Number(form.paid_amount),
        discount_amount: Number(form.discount_amount),
        transportation_charges: transport,
        other_charges: otherCharges,
        gst_percent: Number(form.gst_percent),
        notes: form.notes,
        account,
        items: items.map((it, idx) => ({
          ...it,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          gst_percent: Number(it.gst_percent),
          discount_percent: Number(it.discount_percent),
          basic_amount: itemTotals[idx]?.basic_amount || 0,
          gst_amount: itemTotals[idx]?.gst_amount || 0,
        }))
      }, user?.uid)
      toast.success(`✅ Purchase ${res.purchase_number} created — ${fmt(grandTotal)}`)
      setItems([])
      setForm({
        vendor_id: '', vendor_invoice_number: '', bill_date: new Date().toISOString().split('T')[0],
        due_date: '', payment_mode: 'cash', paid_amount: 0, discount_amount: 0,
        transportation_charges: 0, other_charges: 0, gst_percent: 0, notes: ''
      })
    } catch (err) { toast.error(err.message || 'Failed to create purchase') } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1>🚚 New Vendor Bill / Purchase</h1>
        <p>Record vendor invoice with GST, transportation & other charges — stock updates automatically</p>
      </div>

      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16 }}>

          {/* Left: Product Selection + Items Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Product Search */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">🔍 Select Products</span>
              </div>
              <div className="card-body">
                <input className="form-control" placeholder="Search products by name or code..."
                  value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {products.slice(0, 40).map(p => (
                    <div key={p.id} className="product-card" onClick={() => addItem(p)} style={{ padding: 10 }}>
                      <div className="product-card-name" style={{ fontSize: 11 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{p.product_code}</div>
                      <div className="product-card-price" style={{ fontSize: 12 }}>{fmt(p.purchase_price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Purchase Items Table */}
            {items.length > 0 && (
              <div className="card">
                <div className="card-header"><span className="card-title">📦 Purchase Items</span></div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th style={{ textAlign: 'center' }}>Qty</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Purchase Rate</th>
                          <th style={{ textAlign: 'right' }}>Basic Amount</th>
                          <th style={{ textAlign: 'center' }}>GST %</th>
                          <th style={{ textAlign: 'right' }}>GST Amount</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Disc%:
                                <input type="number" value={item.discount_percent} min="0" max="100"
                                  onChange={e => setItemField(idx, 'discount_percent', e.target.value)}
                                  style={{ width: 40, background: 'none', border: 'none', color: 'var(--warning)', fontSize: 11, padding: '0 2px', outline: 'none' }} />%
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input type="number" value={item.quantity} min="0.01" step="0.01"
                                onChange={e => setItemField(idx, 'quantity', e.target.value)}
                                style={{ width: 64, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'center' }} />
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit || 'Pc'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <input type="number" value={item.unit_price} min="0" step="0.01"
                                onChange={e => setItemField(idx, 'unit_price', e.target.value)}
                                style={{ width: 90, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'right' }} />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {fmt(itemTotals[idx]?.basic_amount)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input type="number" value={item.gst_percent} min="0" max="100" step="0.5"
                                onChange={e => setItemField(idx, 'gst_percent', e.target.value)}
                                style={{ width: 50, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', textAlign: 'center' }} />
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--info)', fontSize: 12 }}>
                              {fmt(itemTotals[idx]?.gst_amount)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                              {fmt(itemTotals[idx]?.total)}
                            </td>
                            <td>
                              <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(idx)}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Vendor Details + Payment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Vendor & Bill Details */}
            <div className="card">
              <div className="card-header"><span className="card-title">📋 Vendor Bill Details</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Vendor Name *</label>
                  <select className="form-control" value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} required>
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name} {v.company_name ? `(${v.company_name})` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor Bill / Invoice No.</label>
                  <input className="form-control" value={form.vendor_invoice_number}
                    onChange={e => set('vendor_invoice_number', e.target.value)} placeholder="Vendor's invoice number" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bill Date *</label>
                    <input type="date" className="form-control" value={form.bill_date} onChange={e => set('bill_date', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Due Date</label>
                    <input type="date" className="form-control" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Account</label>
                  <div style={{ padding: '8px 12px', background: 'rgba(124,58,237,0.08)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.2)', fontSize: 13, fontWeight: 600, color: 'var(--primary-light)' }}>
                    {account === 'Combined' ? '🔗 Combined (All)' : account === 'VR' ? '🔵 VR Account' : '🟢 Janta Account'}
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>Set from the top bar account selector</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill Summary & Charges */}
            <div className="card">
              <div className="card-header"><span className="card-title">💰 Bill Summary</span></div>
              <div className="card-body">
                {/* Summary breakdown */}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <div className="pos-total-row"><span>Basic Amount (Qty × Rate)</span><span style={{ fontWeight: 700 }}>{fmt(subtotal)}</span></div>
                  {itemDiscTotal > 0 && <div className="pos-total-row" style={{ color: 'var(--warning)' }}><span>Item Discounts</span><span>-{fmt(itemDiscTotal)}</span></div>}
                  {totalGst > 0 && <div className="pos-total-row" style={{ color: 'var(--info)' }}><span>GST Amount</span><span>+{fmt(totalGst)}</span></div>}
                  {transport > 0 && <div className="pos-total-row" style={{ color: 'var(--text-secondary)' }}><span>Transportation</span><span>+{fmt(transport)}</span></div>}
                  {otherCharges > 0 && <div className="pos-total-row" style={{ color: 'var(--text-secondary)' }}><span>Other Charges</span><span>+{fmt(otherCharges)}</span></div>}
                  {billDisc > 0 && <div className="pos-total-row" style={{ color: 'var(--warning)' }}><span>Bill Discount</span><span>-{fmt(billDisc)}</span></div>}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                    <div className="pos-total-final"><span>Total Bill Amount</span><span style={{ color: 'var(--primary-light)', fontSize: 16 }}>{fmt(grandTotal)}</span></div>
                  </div>
                </div>

                {/* Charges inputs */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Transportation (₹)</label>
                    <input type="number" className="form-control" value={form.transportation_charges}
                      onChange={e => set('transportation_charges', e.target.value)} min="0" step="0.01" placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Other Charges (₹)</label>
                    <input type="number" className="form-control" value={form.other_charges}
                      onChange={e => set('other_charges', e.target.value)} min="0" step="0.01" placeholder="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Bill Discount (₹)</label>
                  <input type="number" className="form-control" value={form.discount_amount}
                    onChange={e => set('discount_amount', e.target.value)} min="0" step="0.01" placeholder="0" />
                </div>

                {/* Payment */}
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-control" value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
                    <option value="cash">💵 Cash</option>
                    <option value="upi">📱 UPI</option>
                    <option value="card">💳 Card / Cheque</option>
                    <option value="bank">🏧 Bank Transfer</option>
                    <option value="credit">🕐 Credit (Pay Later)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid (₹)</label>
                  <input type="number" className="form-control" value={form.paid_amount}
                    onChange={e => set('paid_amount', e.target.value)} min="0" step="0.01" />
                </div>

                {/* Outstanding */}
                {outstanding > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>OUTSTANDING AMOUNT</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>{fmt(outstanding)}</div>
                    {form.due_date && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Due: {form.due_date}</div>}
                    <div style={{ fontSize: 11, color: 'var(--info)', marginTop: 2 }}>⏰ A payment reminder will be created automatically</div>
                  </div>
                )}
                {outstanding <= 0 && grandTotal > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>✅ Fully Paid</div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional notes..." />
                </div>

                <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: 14, marginTop: 8 }}
                  disabled={submitting || items.length === 0}>
                  {submitting ? '⏳ Saving...' : `✅ Create Purchase Bill — ${fmt(grandTotal)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
