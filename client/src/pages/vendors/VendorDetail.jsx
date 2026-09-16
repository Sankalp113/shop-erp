import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function VendorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState(null)
  const [ledger, setLedger] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ledger')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => { load() }, [id])
  async function load() {
    const [v, l, p] = await Promise.all([
      api.get(`/vendors/${id}`),
      api.get(`/vendors/${id}/ledger`),
      api.get('/purchases', { params: { vendor_id: id, limit: 50 } }),
    ])
    setVendor(v.data); setForm(v.data)
    setLedger(l.data); setPurchases(p.data.data)
    setLoading(false)
  }

  async function saveEdit() {
    try {
      await api.put(`/vendors/${id}`, form)
      toast.success('Vendor updated'); setEditing(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  if (loading) return <div className="loading-overlay"><span className="loading-spinner"/></div>
  if (!vendor) return <div className="empty-state"><h3>Vendor not found</h3></div>

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
            <button className="btn btn-secondary" onClick={()=>setEditing(!editing)}>{editing ? 'Cancel' : '✏️ Edit'}</button>
            {editing && <button className="btn btn-primary" onClick={saveEdit}>✅ Save</button>}
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
                <thead><tr><th>Purchase #</th><th>Date</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>Paid</th><th style={{textAlign:'right'}}>Outstanding</th><th>Status</th></tr></thead>
                <tbody>{purchases.map(p=>(
                  <tr key={p.id}>
                    <td style={{fontWeight:600,color:'var(--primary-light)'}}>{p.purchase_number}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.purchase_date}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(p.total_amount)}</td>
                    <td style={{textAlign:'right',color:'var(--success)'}}>{fmt(p.paid_amount)}</td>
                    <td style={{textAlign:'right',color:p.outstanding_amount>0?'var(--danger)':'var(--text-muted)'}}>{fmt(p.outstanding_amount)}</td>
                    <td><span className={`badge ${p.status==='paid'?'badge-success':p.status==='partial'?'badge-warning':'badge-danger'}`}>{p.status}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            }
          </div>
        </div>
      )}
    </div>
  )
}
