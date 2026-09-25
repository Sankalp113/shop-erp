import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getVendor, getVendorLedger, getPurchases, updateVendor, deleteVendor, deletePurchase, recordPurchasePayment } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { useRefresh } from '../../context/RefreshContext'


const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function VendorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState(null)
  const [ledger, setLedger] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ledger')
  const { user } = useAuth()
  const { refresh } = useRefresh()
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'cash', payment_date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)


  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})


  useEffect(() => { load() }, [id])
  async function load() {

    const [v, l, p] = await Promise.all([
      getVendor(id),
      getVendorLedger(id),
      getPurchases({ vendor_id: id, limit: 50 }),
    ])
    setVendor(v); setForm(v || {})
    setLedger(l); setPurchases(p?.data || [])
    setLoading(false)
  }

  async function saveEdit() {
    try { await updateVendor(id, form); toast.success('Vendor updated'); setEditing(false); refresh('vendors'); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDeleteVendor() {
    if (!window.confirm(`Delete vendor "${vendor?.name}"? This cannot be undone.`)) return
    try { await deleteVendor(id); toast.success('Vendor deleted'); refresh('vendors'); navigate('/vendors') }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDeletePurchase(p) {
    if (!window.confirm(`Delete purchase ${p.purchase_number}? Stock will be reversed.`)) return
    try { await deletePurchase(p.id); toast.success('Deleted'); refresh('purchases','stock','products'); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handlePayPurchase(e) {
    e.preventDefault()
    if (!payForm.amount) return toast.error('Enter amount')
    setSaving(true)
    try {
      await recordPurchasePayment(payModal.id, { amount: Number(payForm.amount), payment_mode: payForm.payment_mode, payment_date: payForm.payment_date }, user?.uid)
      toast.success('Payment recorded'); setPayModal(null); refresh('purchases'); load()
    } catch (err) { toast.error(err.message || 'Failed') } finally { setSaving(false) }
  }

  if (loading) return <div className="loading-overlay"><span className="loading-spinner"/></div>
  if (!vendor) return <div className="empty-state"><h3>Vendor not found</h3></div>

  const outstanding = vendor.total_outstanding || 0


  return (
    <div>
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/vendors')} style={{marginBottom:8}}>← Back to Vendors</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h1>🏭 {vendor.name}</h1>
            <p style={{color:'var(--text-muted)'}}>{vendor.company_name || ''} {vendor.city ? `· ${vendor.city}` : ''} {vendor.mobile ? `· ${vendor.mobile}` : ''}</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            {outstanding > 0 && <button className="btn btn-warning" onClick={() => { setPayModal({ id: 'vendor', purchase_number: vendor.name, outstanding_amount: vendor.total_outstanding }); setPayForm(p => ({...p, amount: (vendor.total_outstanding||0).toFixed(2)})) }}>💳 Pay Vendor</button>}
            <button className="btn btn-secondary" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : '✏️ Edit'}</button>
            {editing && <button className="btn btn-primary" onClick={saveEdit}>✅ Save</button>}
            <button className="btn" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={handleDeleteVendor}>🗑️ Delete</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        {[
          { label:'Total Purchased', val:fmt(vendor.total_purchased), color:'var(--primary-light)' },
          { label:'Total Paid', val:fmt((vendor.total_purchased||0)-(vendor.total_outstanding||0)), color:'var(--success)' },
          { label:'Outstanding', val:fmt(vendor.total_outstanding), color:'var(--danger)' },
          { label:'Payment Terms', val:`${vendor.payment_terms||0} days`, color:'var(--accent)' },
        ].map(s=>(
          <div key={s.label} className="card">
            <div className="card-body">
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">Edit Vendor</span></div>
          <div className="card-body">
            <div className="form-row">
              {[['name','Name'],['company_name','Company'],['mobile','Mobile'],['email','Email'],['gstin','GSTIN'],['city','City'],['address','Address'],['payment_terms','Payment Terms']].map(([k,l])=>(
                <div key={k} className="form-group">
                  <label className="form-label">{l}</label>
                  <input className="form-control" value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        {['ledger','purchases'].map(t=>(
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='ledger'?'📒 Ledger':'🚚 Purchases'}
          </button>
        ))}
      </div>

      {tab === 'ledger' && (
        <div className="card">
          <div className="card-body" style={{padding:0}}>
            {ledger.length===0
              ? <div className="empty-state"><div className="empty-state-icon">📒</div><h3>No transactions yet</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Date</th><th>Description</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Credit</th><th style={{textAlign:'right'}}>Balance</th></tr></thead>
                <tbody>{ledger.map((l,i)=>(
                  <tr key={i}>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.transaction_date}</td>
                    <td>{l.description}</td>
                    <td style={{textAlign:'right',color:'var(--danger)',fontWeight:l.debit_amount>0?700:400}}>{l.debit_amount>0?fmt(l.debit_amount):'—'}</td>
                    <td style={{textAlign:'right',color:'var(--success)',fontWeight:l.credit_amount>0?700:400}}>{l.credit_amount>0?fmt(l.credit_amount):'—'}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(l.balance)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            }
          </div>
        </div>
      )}

      {tab === 'purchases' && (
        <div className="card">
          <div className="card-body" style={{padding:0}}>
            {purchases.length===0
              ? <div className="empty-state"><div className="empty-state-icon">🚚</div><h3>No purchases from this vendor</h3></div>
              : <div className="table-container"><table className="table">
                  <thead><tr><th>Purchase #</th><th>Date</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>Paid</th><th style={{textAlign:'right'}}>Outstanding</th><th>Status</th><th></th></tr></thead>
                  <tbody>{purchases.map(p=>(
                    <tr key={p.id}>
                      <td style={{fontWeight:600,color:'var(--primary-light)'}}>{p.purchase_number}</td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.purchase_date}</td>
                      <td style={{textAlign:'right',fontWeight:700}}>{fmt(p.total_amount)}</td>
                      <td style={{textAlign:'right',color:'var(--success)'}}>{fmt(p.paid_amount)}</td>
                      <td style={{textAlign:'right',color:p.outstanding_amount>0?'var(--danger)':'var(--text-muted)'}}>{fmt(p.outstanding_amount)}</td>
                      <td><span className={`badge ${p.status==='paid'?'badge-success':p.status==='partial'?'badge-warning':'badge-danger'}`}>{p.status}</span></td>
                      <td><div style={{display:'flex',gap:4}}>
                        {p.outstanding_amount > 0 && <button className="btn btn-sm btn-warning" onClick={() => { setPayModal(p); setPayForm(pf => ({...pf, amount: p.outstanding_amount.toFixed(2)})) }}>💳 Pay</button>}
                        <button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={() => handleDeletePurchase(p)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}</tbody>
              </table></div>
            }
          </div>
        </div>
      )}

      {/* Pay Purchase Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💳 Record Payment — {payModal.purchase_number}</span><button className="modal-close" onClick={() => setPayModal(null)}>✕</button></div>
            <form onSubmit={handlePayPurchase}>
              <div className="modal-body">
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>Outstanding: <strong style={{color:'var(--warning)'}}>{fmt(payModal.outstanding_amount)}</strong></p>
                <div className="form-group"><label className="form-label">Amount *</label>
                  <input type="number" className="form-control" value={payForm.amount} min="0.01" step="0.01" required onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">Payment Mode</label>
                  <select className="form-control" value={payForm.payment_mode} onChange={e => setPayForm(p => ({...p, payment_mode: e.target.value}))}>
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card/Cheque</option><option value="bank">Bank Transfer</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Date</label>
                  <input type="date" className="form-control" value={payForm.payment_date} onChange={e => setPayForm(p => ({...p, payment_date: e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? '⏳...' : '✅ Confirm Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
