import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getVendors, getProducts, getPurchases, getPurchase, createPurchase, updatePurchase, recordPurchasePayment, deletePurchase } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { useRefresh } from '../../context/RefreshContext'


const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const today = () => new Date().toISOString().split('T')[0]
const BLANK_FORM = { vendor_id:'', vendor_invoice_number:'', purchase_date: today(), payment_mode:'cash', paid_amount:0, discount_amount:0, notes:'' }

export default function PurchaseHistory() {
  const { user } = useAuth()
  const { refresh } = useRefresh()

  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('this_month')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ amount:'', payment_mode:'cash', payment_date: today() })

  // Edit state
  const [editModal, setEditModal] = useState(null) // holds purchase being edited
  const [editForm, setEditForm] = useState(BLANK_FORM)
  const [editItems, setEditItems] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getVendors({ limit: 200 }).then(r => setVendors(r.data))
    loadProducts()
  }, [])
  useEffect(() => { loadProducts() }, [productSearch])
  useEffect(() => { load() }, [period, from, to, vendorId, page])

  async function loadProducts() {
    const r = await getProducts({ search: productSearch, limit: 100 })
    setProducts(r.data)
  }

  function getDateRange() {
    const d = new Date(), f = d => d.toISOString().split('T')[0]
    if (period === 'today') return { from: f(d), to: f(d) }
    if (period === 'this_week') { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return { from: f(s), to: f(d) } }
    if (period === 'this_month') return { from: f(d).slice(0,7) + '-01', to: f(d) }
    if (period === 'last_month') { const lm = new Date(d.getFullYear(), d.getMonth()-1, 1); const le = new Date(d.getFullYear(), d.getMonth(), 0); return { from: f(lm), to: f(le) } }
    if (period === 'custom') return { from, to }
    return {}
  }

  async function load() {
    setLoading(true)
    const range = getDateRange()
    const r = await getPurchases({ ...range, vendor_id: vendorId, limit: 50 })
    setPurchases(r.data); setTotal(r.total); setLoading(false)
  }

  async function loadDetail(id) {
    const p = await getPurchase(id)
    setDetail(p)
  }

  async function openEdit(p) {
    const full = await getPurchase(p.id)
    setEditForm({
      vendor_id: full.vendor_id || '',
      vendor_invoice_number: full.vendor_invoice_number || '',
      purchase_date: full.purchase_date || today(),
      payment_mode: full.payment_mode || 'cash',
      paid_amount: full.paid_amount || 0,
      discount_amount: full.discount_amount || 0,
      notes: full.notes || ''
    })
    setEditItems(full.items?.map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_percent: it.discount_percent || 0,
      tax_percent: it.tax_percent || 0
    })) || [])
    setEditModal(full)
    setProductSearch('')
  }

  function closeEdit() { setEditModal(null); setEditItems([]); setEditForm(BLANK_FORM); setProductSearch('') }

  function addProductToEdit(product) {
    setEditItems(prev => {
      const ex = prev.find(i => i.product_id === product.id)
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.purchase_price || 0, discount_percent: 0, tax_percent: product.tax_percent || 0 }]
    })
  }
  function removeEditItem(idx) { setEditItems(prev => prev.filter((_, i) => i !== idx)) }
  function setEditItemField(idx, k, v) { setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: Number(v) || v } : it)) }

  const calcItemGross = it => it.unit_price * it.quantity
  const calcItemDisc  = it => calcItemGross(it) * (it.discount_percent || 0) / 100
  const calcItemNet   = it => calcItemGross(it) - calcItemDisc(it)
  const calcItemTax   = it => calcItemNet(it) * (it.tax_percent || 0) / 100
  const calcItemTotal = it => calcItemNet(it) + calcItemTax(it)

  const editSubtotal      = editItems.reduce((s, it) => s + calcItemGross(it), 0)
  const editItemDiscTotal = editItems.reduce((s, it) => s + calcItemDisc(it), 0)
  const editTaxTotal      = editItems.reduce((s, it) => s + calcItemTax(it), 0)
  const editGrandTotal    = editSubtotal - editItemDiscTotal - Number(editForm.discount_amount || 0) + editTaxTotal

  async function submitEdit(e) {
    e.preventDefault()
    if (editItems.length === 0) return toast.error('Add at least one item')
    setSaving(true)
    try {
      const vendorObj = vendors.find(v => v.id === editForm.vendor_id)
      await updatePurchase(editModal.id, {
        ...editForm,
        vendor_name: vendorObj?.name || editModal.vendor_name || '',
        items: editItems,
        paid_amount: Number(editForm.paid_amount),
        discount_amount: Number(editForm.discount_amount)
      }, user?.uid)
      toast.success(`✅ Purchase ${editModal.purchase_number} updated`)
      refresh('purchases', 'stock', 'products')
      closeEdit(); load()

      if (detail?.id === editModal.id) loadDetail(editModal.id)
    } catch (err) { toast.error(err.message || 'Failed') } finally { setSaving(false) }
  }

  async function makePayment() {
    try {
      await recordPurchasePayment(payModal.id, payForm, user?.uid)
      toast.success('Payment recorded')
      setPayModal(null); load()
      if (detail?.id === payModal.id) loadDetail(payModal.id)
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const statusBadge = s => ({ paid: 'badge-success', partial: 'badge-warning', pending: 'badge-danger' }[s] || 'badge-muted')
  const setF = (k,v) => setEditForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>📋 Purchase History</h1><p>All purchase orders and payments</p></div>
        <a href="/purchases/new" className="btn btn-primary">➕ New Purchase</a>
      </div>

      <div className="date-filter">
        {['today','this_week','this_month','last_month','custom'].map(p => (
          <button key={p} className={`date-filter-btn ${period===p?'active':''}`} onClick={() => { setPeriod(p); setPage(1) }}>
            {p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
        {period === 'custom' && (<>
          <input type="date" className="form-control" style={{width:'auto'}} value={from} onChange={e=>setFrom(e.target.value)}/>
          <input type="date" className="form-control" style={{width:'auto'}} value={to} onChange={e=>setTo(e.target.value)}/>
        </>)}
        <select className="form-control" value={vendorId} onChange={e=>{setVendorId(e.target.value);setPage(1)}} style={{width:180,marginLeft:'auto'}}>
          <option value="">All Vendors</option>
          {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : purchases.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">🚚</div><h3>No purchases found</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Purchase #</th><th>Date</th><th>Vendor</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>Paid</th><th style={{textAlign:'right'}}>Outstanding</th><th>Status</th><th></th></tr></thead>
                <tbody>{purchases.map(p=>(
                  <tr key={p.id}>
                    <td><span className="table-link" onClick={()=>loadDetail(p.id)}>{p.purchase_number}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.purchase_date}</td>
                    <td>{p.vendor_name||<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(p.total_amount)}</td>
                    <td style={{textAlign:'right',color:'var(--success)'}}>{fmt(p.paid_amount)}</td>
                    <td style={{textAlign:'right',color:p.outstanding_amount>0?'var(--danger)':'var(--text-muted)',fontWeight:p.outstanding_amount>0?700:400}}>{fmt(p.outstanding_amount)}</td>
                    <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm btn-ghost" onClick={()=>loadDetail(p.id)}>👁</button>
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(p)} title="Edit purchase">✏️</button>
                      {p.outstanding_amount>0 && <button className="btn btn-sm btn-warning" onClick={()=>{ setPayModal(p); setPayForm({amount:p.outstanding_amount.toFixed(2),payment_mode:'cash',payment_date:today()}) }}>💳 Pay</button>}
                      <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={async()=>{if(!window.confirm(`Delete purchase ${p.purchase_number}? Stock will be reversed.`))return;try{await deletePurchase(p.id);toast.success('Purchase deleted');refresh('purchases','stock','products');load()}catch(e){toast.error(e.message)}}}>🗑️</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {total > 50 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{fontSize:13,color:'var(--text-muted)',alignSelf:'center'}}>{page} / {Math.ceil(total/50)}</span>
          <button className="btn btn-secondary btn-sm" disabled={page*50>=total} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}

      {/* ── Detail View Modal ── */}
      {detail && !editModal && (
        <div className="modal-overlay" onClick={()=>setDetail(null)}>
          <div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div><div className="modal-title">🚚 {detail.purchase_number}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{detail.purchase_date} · {detail.vendor_name||'Unknown vendor'}</div></div>
              <button className="modal-close" onClick={()=>setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="table">
                <thead><tr><th>Product</th><th style={{textAlign:'center'}}>Qty</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
                <tbody>{detail.items?.map((it,i)=><tr key={i}><td>{it.product_name}</td><td style={{textAlign:'center'}}>{it.quantity}</td><td style={{textAlign:'right'}}>{fmt(it.unit_price)}</td><td style={{textAlign:'right',fontWeight:700}}>{fmt(it.total_price)}</td></tr>)}</tbody>
              </table>
              <div className="divider"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13}}>
                <div>
                  <div>Total: <strong>{fmt(detail.total_amount)}</strong></div>
                  <div style={{color:'var(--success)'}}>Paid: <strong>{fmt(detail.paid_amount)}</strong></div>
                  {detail.outstanding_amount>0 && <div style={{color:'var(--danger)',fontWeight:700}}>Outstanding: {fmt(detail.outstanding_amount)}</div>}
                  {detail.notes && <div style={{color:'var(--text-muted)',marginTop:4}}>Notes: {detail.notes}</div>}
                </div>
                <div>
                  {detail.payments?.map((pay,i)=><div key={i} style={{fontSize:12,color:'var(--text-muted)'}}>Payment {i+1}: {fmt(pay.amount)} · {pay.payment_date}</div>)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(detail)}>✏️ Edit</button>
              {detail.outstanding_amount>0 && <button className="btn btn-warning" onClick={()=>{setPayModal(detail);setPayForm({amount:detail.outstanding_amount.toFixed(2),payment_mode:'cash',payment_date:today()})}}>💳 Record Payment</button>}
              <button className="btn btn-secondary" onClick={()=>setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Edit Modal ── */}
      {editModal && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" style={{maxWidth:900,width:'95vw',maxHeight:'90vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-title">✏️ Edit Purchase — {editModal.purchase_number}</span>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Editing will recalculate stock — old items reversed, new items applied</div>
              </div>
              <button className="modal-close" onClick={closeEdit}>✕</button>
            </div>
            <form onSubmit={submitEdit} style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
              <div className="modal-body" style={{overflowY:'auto',flex:1}}>

                {/* Header fields */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
                  <div className="form-group">
                    <label className="form-label">Vendor</label>
                    <select className="form-control" value={editForm.vendor_id} onChange={e=>setF('vendor_id',e.target.value)}>
                      <option value="">Select vendor</option>
                      {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input type="date" className="form-control" value={editForm.purchase_date} onChange={e=>setF('purchase_date',e.target.value)}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor Invoice #</label>
                    <input className="form-control" value={editForm.vendor_invoice_number} onChange={e=>setF('vendor_invoice_number',e.target.value)} placeholder="Vendor bill number"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select className="form-control" value={editForm.payment_mode} onChange={e=>setF('payment_mode',e.target.value)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option><option value="credit">Credit</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount Paid (₹)</label>
                    <input type="number" className="form-control" value={editForm.paid_amount} onChange={e=>setF('paid_amount',e.target.value)} min="0" step="0.01"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Overall Discount (₹)</label>
                    <input type="number" className="form-control" value={editForm.discount_amount} onChange={e=>setF('discount_amount',e.target.value)} min="0" step="0.01"/>
                  </div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label">Notes</label>
                    <input className="form-control" value={editForm.notes} onChange={e=>setF('notes',e.target.value)} placeholder="Optional notes..."/>
                  </div>
                </div>

                {/* Product search to add more items */}
                <div style={{marginBottom:12}}>
                  <label className="form-label">Add / Change Products</label>
                  <input className="form-control" placeholder="🔍 Search to add products..." value={productSearch} onChange={e=>setProductSearch(e.target.value)} style={{marginBottom:8}}/>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,maxHeight:120,overflowY:'auto'}}>
                    {products.slice(0,20).map(p=>(
                      <button key={p.id} type="button" onClick={()=>addProductToEdit(p)} style={{padding:'4px 10px',fontSize:12,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:20,cursor:'pointer',color:'var(--text-primary)'}}>
                        ＋ {p.name} · ₹{p.purchase_price}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items table */}
                {editItems.length === 0
                  ? <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)',border:'1px dashed var(--border)',borderRadius:8}}>No items — search above to add products</div>
                  : <table className="table">
                    <thead><tr>
                      <th>Product</th>
                      <th style={{textAlign:'center',width:80}}>Qty</th>
                      <th style={{textAlign:'right',width:110}}>Unit Price</th>
                      <th style={{textAlign:'right',width:80}}>Disc%</th>
                      <th style={{textAlign:'right',width:80}}>Tax%</th>
                      <th style={{textAlign:'right',width:100}}>Total</th>
                      <th style={{width:40}}></th>
                    </tr></thead>
                    <tbody>{editItems.map((it,idx)=>(
                      <tr key={idx}>
                        <td style={{fontWeight:500,fontSize:13}}>{it.product_name}</td>
                        <td><input type="number" value={it.quantity} min="1" onChange={e=>setEditItemField(idx,'quantity',e.target.value)} style={{width:60,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',color:'var(--text-primary)',textAlign:'center'}}/></td>
                        <td><input type="number" value={it.unit_price} min="0" step="0.01" onChange={e=>setEditItemField(idx,'unit_price',e.target.value)} style={{width:90,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',color:'var(--text-primary)',textAlign:'right'}}/></td>
                        <td><input type="number" value={it.discount_percent} min="0" max="100" onChange={e=>setEditItemField(idx,'discount_percent',e.target.value)} style={{width:60,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',color:'var(--text-primary)',textAlign:'right'}}/></td>
                        <td><input type="number" value={it.tax_percent} min="0" max="100" onChange={e=>setEditItemField(idx,'tax_percent',e.target.value)} style={{width:60,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',color:'var(--text-primary)',textAlign:'right'}}/></td>
                        <td style={{textAlign:'right',fontWeight:700}}>{fmt(calcItemGross(it))}</td>

                        <td><button type="button" className="btn btn-danger btn-sm btn-icon" onClick={()=>removeEditItem(idx)}>✕</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                }

                {/* Totals summary */}
                {editItems.length > 0 && (
                  <div style={{marginTop:16,padding:'12px 16px',background:'rgba(124,58,237,0.08)',borderRadius:8,display:'flex',gap:24,fontSize:13,flexWrap:'wrap'}}>
                    <span>Subtotal: <strong>{fmt(editSubtotal)}</strong></span>
                    {editItemDiscTotal > 0 && <span style={{color:'var(--warning)'}}>Item Disc: <strong>-{fmt(editItemDiscTotal)}</strong></span>}
                    <span>Bill Discount: <strong style={{color:'var(--warning)'}}>-{fmt(editForm.discount_amount||0)}</strong></span>
                    {editTaxTotal > 0 && <span>Tax (GST): <strong>+{fmt(editTaxTotal)}</strong></span>}
                    <span style={{fontSize:15,fontWeight:800}}>Grand Total: <strong style={{color:'var(--primary-light)'}}>{fmt(editGrandTotal)}</strong></span>
                    <span>Paid: <strong style={{color:'var(--success)'}}>{fmt(editForm.paid_amount||0)}</strong></span>
                    <span style={{color: editGrandTotal - (editForm.paid_amount||0) > 0 ? 'var(--danger)' : 'var(--success)'}}>
                      Outstanding: <strong>{fmt(Math.max(0, editGrandTotal - (editForm.paid_amount||0)))}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳ Saving...' : '💾 Update Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {payModal && (
        <div className="modal-overlay" onClick={()=>setPayModal(null)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💳 Record Payment</span><button className="modal-close" onClick={()=>setPayModal(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Outstanding: <strong style={{color:'var(--danger)'}}>{fmt(payModal.outstanding_amount)}</strong></p>
              <div className="form-group"><label className="form-label">Amount *</label>
                <input type="number" className="form-control" value={payForm.amount} max={payModal.outstanding_amount} onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Payment Mode</label>
                <select className="form-control" value={payForm.payment_mode} onChange={e=>setPayForm(p=>({...p,payment_mode:e.target.value}))}>
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option>
                </select></div>
              <div className="form-group"><label className="form-label">Payment Date</label>
                <input type="date" className="form-control" value={payForm.payment_date} onChange={e=>setPayForm(p=>({...p,payment_date:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setPayModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={makePayment}>✅ Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
