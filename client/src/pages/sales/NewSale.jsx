import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProducts, getCategories, getCustomers, createSale } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from '../../context/AccountContext'

const fmt = (n) => Number(n || 0).toFixed(2)
const fmtRs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function NewSale() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { account } = useAccount()
  const searchRef = useRef(null)

  const [products, setProducts] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [billDiscount, setBillDiscount] = useState(0)
  const [billDiscountType, setBillDiscountType] = useState('amount') // 'amount' | 'percent'
  const [paymentMode, setPaymentMode] = useState('cash')
  const [payments, setPayments] = useState({ cash: 0, upi: 0, card: 0, credit: 0 })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState([])
  const [selCat, setSelCat] = useState('')
  const [lastInvoice, setLastInvoice] = useState(null)

  useEffect(() => {
    getCategories().then(setCategories)
    loadProducts()
    searchRef.current?.focus()
  }, [])
  useEffect(() => { loadProducts() }, [search, selCat])

  async function loadProducts() {
    const r = await getProducts({ search, category_id: selCat, limit: 60 })
    setProducts(r.data)
  }

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      const r = await getCustomers({ search: customerSearch, limit: 8 })
      setCustomerResults(r.data)
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  function addToCart(product) {
    if ((product.total_stock || 0) <= 0) {
      toast.error(`⚠️ ${product.name} is out of stock`)
      return
    }
    setCartItems(prev => {
      const existing = prev.find(i => i.product_id === product.id && !i.variant_id)
      if (existing) {
        const newQty = existing.quantity + 1
        if (newQty > (product.total_stock || 0)) {
          toast.error(`⚠️ Only ${product.total_stock} in stock`)
          return prev
        }
        return prev.map(i => i.product_id === product.id && !i.variant_id
          ? { ...i, quantity: newQty }
          : i)
      }
      return [...prev, {
        product_id: product.id,
        variant_id: null,
        product_name: product.name,
        product_code: product.product_code,
        unit: product.unit || 'Piece',
        unit_price: product.selling_price,
        purchase_price: product.purchase_price,
        available_stock: product.total_stock || 0,
        quantity: 1,
        discount_percent: 0,
        discount_amount_item: 0,
        discount_mode: 'percent', // 'percent' | 'amount'
        tax_percent: product.tax_percent || 0,
        size: null, color: null,
      }]
    })
  }

  function removeFromCart(idx) { setCartItems(prev => prev.filter((_, i) => i !== idx)) }

  function updateQty(idx, qty) {
    const item = cartItems[idx]
    if (qty <= 0) return removeFromCart(idx)
    if (qty > (item.available_stock || 9999)) {
      toast.error(`⚠️ Only ${item.available_stock} units in stock`)
      return
    }
    setCartItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: qty } : it))
  }

  function updateItemDiscount(idx, value, mode) {
    setCartItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const gross = it.unit_price * it.quantity
      if (mode === 'amount') {
        const pct = gross > 0 ? (Number(value) / gross * 100) : 0
        return { ...it, discount_amount_item: Number(value), discount_percent: pct, discount_mode: 'amount' }
      } else {
        const amt = gross * Number(value) / 100
        return { ...it, discount_percent: Number(value), discount_amount_item: amt, discount_mode: 'percent' }
      }
    }))
  }

  // Per-item calculations
  const itemTotals = cartItems.map(item => {
    const gross = item.unit_price * item.quantity
    const disc = item.discount_mode === 'amount'
      ? Math.min(Number(item.discount_amount_item), gross)
      : gross * Number(item.discount_percent || 0) / 100
    const net = gross - disc
    const tax = net * Number(item.tax_percent || 0) / 100
    return { gross, disc, net, tax, total: net + tax }
  })

  const subtotal = itemTotals.reduce((s, t) => s + t.gross, 0)
  const itemDiscTotal = itemTotals.reduce((s, t) => s + t.disc, 0)
  const totalTax = itemTotals.reduce((s, t) => s + t.tax, 0)

  // Bill discount: percent or flat amount
  const billDiscAmount = billDiscountType === 'percent'
    ? (subtotal - itemDiscTotal) * Number(billDiscount) / 100
    : Number(billDiscount)

  const grandTotal = subtotal - itemDiscTotal - billDiscAmount + totalTax
  const totalPaid = Number(payments.cash) + Number(payments.upi) + Number(payments.card)
  const change = totalPaid - grandTotal

  function handlePaymentModeChange(mode) {
    setPaymentMode(mode)
    if (mode === 'cash') setPayments({ cash: grandTotal.toFixed(2), upi: 0, card: 0, credit: 0 })
    else if (mode === 'upi') setPayments({ cash: 0, upi: grandTotal.toFixed(2), card: 0, credit: 0 })
    else if (mode === 'card') setPayments({ cash: 0, upi: 0, card: grandTotal.toFixed(2), credit: 0 })
    else if (mode === 'credit') setPayments({ cash: 0, upi: 0, card: 0, credit: grandTotal.toFixed(2) })
    else setPayments({ cash: 0, upi: 0, card: 0, credit: 0 })
  }

  async function handleSubmit() {
    if (cartItems.length === 0) return toast.error('Add items to the cart first')
    if (!customer && paymentMode === 'credit') return toast.error('Select a customer for credit sale')
    if (account === 'Combined') return toast.error('Please select VR or Janta account from the top bar before billing')
    setSubmitting(true)
    try {
      const res = await createSale({
        customer_id: customer?.id,
        customer_name: customer?.name,
        customer_mobile: customer?.mobile,
        account,
        items: cartItems.map((item, i) => ({
          ...item,
          discount_amount: itemTotals[i].disc,
          discount_percent: item.discount_percent,
          tax_amount: itemTotals[i].tax,
          total_price: itemTotals[i].total,
        })),
        discount_amount: billDiscAmount,
        cash_amount: Number(payments.cash),
        upi_amount: Number(payments.upi),
        card_amount: Number(payments.card),
        credit_amount: Number(payments.credit),
        payment_mode: paymentMode,
        notes,
      }, user?.uid, user?.username)
      toast.success(`✅ Bill ${res.invoice_number} — ${fmtRs(grandTotal)}`, { duration: 5000 })
      setLastInvoice(res.invoice_number)
      setCartItems([])
      setCustomer(null)
      setBillDiscount(0)
      setPayments({ cash: 0, upi: 0, card: 0, credit: 0 })
      setNotes('')
    } catch (err) {
      toast.error(err.message || 'Failed to create sale')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 16, height: 'calc(100vh - 112px)' }}>
      {/* Products Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        {/* Account indicator */}
        <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: account === 'VR' ? 'rgba(99,102,241,0.12)' : account === 'Janta' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
          border: `1px solid ${account === 'VR' ? 'rgba(99,102,241,0.3)' : account === 'Janta' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          color: account === 'VR' ? '#818cf8' : account === 'Janta' ? 'var(--success)' : 'var(--warning)'
        }}>
          {account === 'VR' ? '🔵 VR Account' : account === 'Janta' ? '🟢 Janta Account' : '⚠️ No account selected — choose VR or Janta from the top bar'}
          {lastInvoice && <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Last: {lastInvoice}</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <input ref={searchRef} className="form-control" placeholder="🔍 Search by name, code, category..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <select className="form-control" value={selCat} onChange={e => setSelCat(e.target.value)} style={{ width: 160 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {products.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">👕</div><h3>No products found</h3></div>
            : <div className="product-grid">
              {products.map(p => (
                <div key={p.id} className="product-card" onClick={() => addToCart(p)}
                  style={{ opacity: (p.total_stock || 0) <= 0 ? 0.5 : 1, cursor: (p.total_stock || 0) <= 0 ? 'not-allowed' : 'pointer' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>👕</div>
                  <div className="product-card-name">{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, fontFamily: 'monospace' }}>{p.product_code}</div>
                  <div className="product-card-price">{fmtRs(p.selling_price)}</div>
                  <div className="product-card-stock" style={{ color: (p.total_stock || 0) <= 0 ? 'var(--danger)' : (p.total_stock || 0) <= (p.min_stock_level || 5) ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {(p.total_stock || 0) <= 0 ? '⛔ Out of Stock' : `Stock: ${p.total_stock} ${p.unit || ''}`}
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      {/* Cart */}
      <div className="pos-cart">
        <div className="pos-cart-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>🛒 Cart ({cartItems.length})</span>
            {cartItems.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setCartItems([])}>Clear</button>}
          </div>
          {/* Customer search */}
          <div style={{ position: 'relative' }}>
            {customer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)' }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>{customer.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{customer.mobile}</div>
                </div>
                <button className="btn-ghost" style={{ fontSize: 16 }} onClick={() => setCustomer(null)}>✕</button>
              </div>
            ) : (
              <input className="form-control" placeholder="👤 Search customer (optional)..." value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)} style={{ fontSize: 13 }} />
            )}
            {customerResults.length > 0 && !customer && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                {customerResults.map(c => (
                  <div key={c.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseDown={() => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]) }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.mobile}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pos-cart-items">
          {cartItems.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>🛒</div>
                <p>Click products to add them</p>
              </div>
            : cartItems.map((item, idx) => (
              <div key={idx} className="cart-item" style={{ flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="cart-item-name">{item.product_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.product_code}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtRs(item.unit_price)} × {item.quantity} {item.unit}</div>
                  </div>
                  <div className="cart-item-qty">
                    <button className="qty-btn" onClick={() => updateQty(idx, item.quantity - 1)}>−</button>
                    <span className="qty-display">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQty(idx, item.quantity + 1)}>+</button>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 64 }}>
                    <div className="cart-item-price">{fmtRs(itemTotals[idx]?.gross)}</div>
                    {itemTotals[idx]?.disc > 0 && <div style={{ fontSize: 10, color: 'var(--warning)' }}>-{fmtRs(itemTotals[idx].disc)}</div>}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>{fmtRs(itemTotals[idx]?.total)}</div>
                    <button style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }} onClick={() => removeFromCart(idx)}>✕</button>
                  </div>
                </div>
                {/* Per-item discount row */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Discount:</span>
                  <select value={item.discount_mode}
                    onChange={e => updateItemDiscount(idx, 0, e.target.value)}
                    style={{ fontSize: 11, padding: '1px 4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}>
                    <option value="percent">%</option>
                    <option value="amount">₹</option>
                  </select>
                  <input type="number" value={item.discount_mode === 'amount' ? item.discount_amount_item : item.discount_percent}
                    min="0" max={item.discount_mode === 'percent' ? 100 : item.unit_price * item.quantity}
                    onChange={e => updateItemDiscount(idx, e.target.value, item.discount_mode)}
                    style={{ width: 50, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--warning)', fontSize: 11, outline: 'none' }}
                    placeholder="0" />
                  {itemTotals[idx]?.disc > 0 && <span style={{ color: 'var(--warning)' }}>= -{fmtRs(itemTotals[idx].disc)}</span>}
                </div>
              </div>
            ))
          }
        </div>

        <div className="pos-cart-footer">
          <div className="pos-total-row"><span>Subtotal</span><span>{fmtRs(subtotal)}</span></div>
          {itemDiscTotal > 0 && (
            <div className="pos-total-row" style={{ color: 'var(--warning)' }}>
              <span>Item Discounts</span><span>-{fmtRs(itemDiscTotal)}</span>
            </div>
          )}

          {/* Bill-level discount */}
          <div className="pos-total-row">
            <span>Bill Discount</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <select value={billDiscountType} onChange={e => { setBillDiscountType(e.target.value); setBillDiscount(0) }}
                style={{ fontSize: 11, padding: '2px 4px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)' }}>
                <option value="amount">₹</option>
                <option value="percent">%</option>
              </select>
              <input type="number" value={billDiscount} min="0"
                onChange={e => setBillDiscount(e.target.value)}
                style={{ width: 70, background: 'none', border: 'none', color: 'var(--warning)', fontWeight: 600, fontSize: 13, textAlign: 'right', outline: 'none' }}
                placeholder="0" />
            </div>
          </div>
          {billDiscAmount > 0 && (
            <div className="pos-total-row" style={{ color: 'var(--warning)', fontSize: 12 }}>
              <span>Bill Discount Applied</span><span>-{fmtRs(billDiscAmount)}</span>
            </div>
          )}
          {totalTax > 0 && <div className="pos-total-row"><span>Tax (GST)</span><span>+{fmtRs(totalTax)}</span></div>}
          <div className="divider" />
          <div className="pos-total-final"><span>TOTAL</span><span style={{ color: 'var(--primary-light)' }}>{fmtRs(grandTotal)}</span></div>

          {/* Payment modes */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[
              { key: 'cash', label: '💵 Cash' },
              { key: 'upi', label: '📱 UPI' },
              { key: 'card', label: '💳 Card' },
              { key: 'credit', label: '🕐 Credit' },
              { key: 'split', label: '🔀 Split' },
            ].map(m => (
              <button key={m.key} className={`btn btn-sm ${paymentMode === m.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: 10, padding: '6px 2px' }}
                onClick={() => handlePaymentModeChange(m.key)}>
                {m.label}
              </button>
            ))}
          </div>

          {paymentMode === 'split' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {[
                { key: 'cash', label: '💵 Cash' },
                { key: 'upi', label: '📱 UPI' },
                { key: 'card', label: '💳 Card' },
                { key: 'credit', label: '🕐 Credit' }
              ].map(m => (
                <div key={m.key}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{m.label}</label>
                  <input type="number" className="form-control" value={payments[m.key]} min="0" placeholder="0"
                    onChange={e => setPayments(p => ({ ...p, [m.key]: e.target.value }))} style={{ padding: '6px 10px', fontSize: 13 }} />
                </div>
              ))}
            </div>
          )}

          {totalPaid > 0 && change !== 0 && (
            <div className="pos-total-row" style={{ color: change > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginBottom: 12 }}>
              <span>{change > 0 ? 'Change Due' : 'Remaining'}</span>
              <span>{fmtRs(Math.abs(change))}</span>
            </div>
          )}

          <textarea className="form-control" placeholder="Notes (optional)..." value={notes}
            onChange={e => setNotes(e.target.value)} rows={1} style={{ marginBottom: 10, fontSize: 12 }} />

          <button className="btn btn-success w-full" style={{ justifyContent: 'center', padding: 14, fontSize: 15 }}
            onClick={handleSubmit} disabled={submitting || cartItems.length === 0}>
            {submitting ? '⏳ Processing...' : `✅ Confirm Sale — ${fmtRs(grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
