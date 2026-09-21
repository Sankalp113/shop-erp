import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProducts, getCategories, getCustomers, createSale } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => Number(n || 0).toFixed(2)
const fmtRs = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function NewSale() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const searchRef = useRef(null)

  const [products, setProducts] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [billDiscount, setBillDiscount] = useState(0)
  const [paymentMode, setPaymentMode] = useState('cash')
  const [payments, setPayments] = useState({ cash: 0, upi: 0, card: 0, credit: 0 })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState([])
  const [selCat, setSelCat] = useState('')

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
    setCartItems(prev => {
      const existing = prev.find(i => i.product_id === product.id && !i.variant_id)
      if (existing) {
        return prev.map(i => i.product_id === product.id && !i.variant_id
          ? { ...i, quantity: i.quantity + 1 }
          : i)
      }
      return [...prev, {
        product_id: product.id,
        variant_id: null,
        product_name: product.name,
        unit_price: product.selling_price,
        purchase_price: product.purchase_price,
        quantity: 1,
        discount_percent: product.discount_percent || 0,
        tax_percent: product.tax_percent || 0,
        size: null, color: null,
      }]
    })
  }

  function removeFromCart(idx) { setCartItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateQty(idx, qty) {
    if (qty <= 0) return removeFromCart(idx)
    setCartItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: qty } : it))
  }
  function updateDiscount(idx, disc) {
    setCartItems(prev => prev.map((it, i) => i === idx ? { ...it, discount_percent: parseFloat(disc) || 0 } : it))
  }

  const itemTotals = cartItems.map(item => {
    const gross = item.unit_price * item.quantity
    const disc = gross * item.discount_percent / 100
    const net = gross - disc
    const tax = net * item.tax_percent / 100
    return { gross, disc, net, tax, total: net + tax }
  })
  const subtotal = itemTotals.reduce((s, t) => s + t.gross, 0)
  const totalDisc = itemTotals.reduce((s, t) => s + t.disc, 0) + Number(billDiscount)
  const totalTax = itemTotals.reduce((s, t) => s + t.tax, 0)
  const grandTotal = subtotal - totalDisc + totalTax
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

    setSubmitting(true)
    try {
      const res = await createSale({
        customer_id: customer?.id,
        customer_name: customer?.name,
        customer_mobile: customer?.mobile,
        items: cartItems.map((item, i) => ({
          ...item,
          discount_amount: itemTotals[i].disc,
          tax_amount: itemTotals[i].tax,
          total_price: itemTotals[i].total,
        })),
        discount_amount: Number(billDiscount),
        cash_amount: Number(payments.cash),
        upi_amount: Number(payments.upi),
        card_amount: Number(payments.card),
        credit_amount: Number(payments.credit),
        payment_mode: paymentMode,
        notes,
      }, user?.uid, user?.username)
      toast.success(`✅ Bill ${res.invoice_number} created — ${fmtRs(grandTotal)}`)
      setCartItems([])
      setCustomer(null)
      setBillDiscount(0)
      setPayments({ cash: 0, upi: 0, card: 0, credit: 0 })
    } catch (err) {
      toast.error(err.message || 'Failed to create sale')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, height: 'calc(100vh - 112px)' }}>
      {/* Products Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <input ref={searchRef} className="form-control" placeholder="🔍 Search products by name, code..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
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
                <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>👕</div>
                  <div className="product-card-name">{p.name}</div>
                  <div className="product-card-price">{fmtRs(p.selling_price)}</div>
                  <div className="product-card-stock" style={{ color: (p.total_stock || 0) <= (p.min_stock_level || 5) ? 'var(--danger)' : 'var(--text-muted)' }}>
                    Stock: {p.total_stock || 0}
                  </div>
                  {p.category_name && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{p.category_name}</div>}
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
              <input className="form-control" placeholder="👤 Search customer..." value={customerSearch}
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
              <div key={idx} className="cart-item">
                <div style={{ flex: 1 }}>
                  <div className="cart-item-name">{item.product_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    <span>{fmtRs(item.unit_price)}</span>
                    <span>·</span>
                    <input type="number" value={item.discount_percent} min="0" max="100" onChange={e => updateDiscount(idx, e.target.value)}
                      style={{ width: 36, background: 'none', border: 'none', color: 'var(--warning)', fontSize: 11, padding: 0, outline: 'none', textAlign: 'center' }} />%off
                  </div>
                </div>
                <div className="cart-item-qty">
                  <button className="qty-btn" onClick={() => updateQty(idx, item.quantity - 1)}>−</button>
                  <span className="qty-display">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQty(idx, item.quantity + 1)}>+</button>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="cart-item-price">{fmtRs(itemTotals[idx]?.total)}</div>
                  <button style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }} onClick={() => removeFromCart(idx)}>✕</button>
                </div>
              </div>
            ))
          }
        </div>

        <div className="pos-cart-footer">
          <div className="pos-total-row"><span>Subtotal</span><span>{fmtRs(subtotal)}</span></div>
          <div className="pos-total-row">
            <span>Bill Discount</span>
            <input type="number" value={billDiscount} min="0" onChange={e => setBillDiscount(e.target.value)}
              style={{ width: 80, background: 'none', border: 'none', color: 'var(--warning)', fontWeight: 600, fontSize: 13, textAlign: 'right', outline: 'none' }}
              placeholder="0" />
          </div>
          {totalTax > 0 && <div className="pos-total-row"><span>Tax</span><span>{fmtRs(totalTax)}</span></div>}
          <div className="divider" />
          <div className="pos-total-final"><span>Total</span><span style={{ color: 'var(--primary-light)' }}>{fmtRs(grandTotal)}</span></div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {['cash', 'upi', 'card', 'credit', 'split'].map(m => (
              <button key={m} className={`btn btn-sm ${paymentMode === m ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '6px 4px' }}
                onClick={() => handlePaymentModeChange(m)}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {paymentMode === 'split' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {['cash', 'upi', 'card', 'credit'].map(m => (
                <div key={m}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>{m}</label>
                  <input type="number" className="form-control" value={payments[m]} min="0" placeholder="0"
                    onChange={e => setPayments(p => ({ ...p, [m]: e.target.value }))} style={{ padding: '6px 10px', fontSize: 13 }} />
                </div>
              ))}
            </div>
          )}

          {totalPaid > 0 && change !== 0 && (
            <div className="pos-total-row" style={{ color: change > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginBottom: 12 }}>
              <span>{change > 0 ? 'Change' : 'Remaining'}</span>
              <span>{fmtRs(Math.abs(change))}</span>
            </div>
          )}

          <button className="btn btn-success w-full" style={{ justifyContent: 'center', padding: 14, fontSize: 15 }}
            onClick={handleSubmit} disabled={submitting || cartItems.length === 0}>
            {submitting ? '⏳ Processing...' : `✅ Confirm Sale — ${fmtRs(grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
