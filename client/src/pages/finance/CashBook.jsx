import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCashBook, addCashTransaction, deleteCashTransaction, updateCashTransaction } from '../../services/db'
import { useAuth } from '../../context/AuthContext'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const BLANK = { transaction_date: new Date().toISOString().split('T')[0], transaction_type:'receipt', description:'', amount:'' }

export default function CashBook() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(new Date(Date.now()-7*86400000).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [from, to])

  async function load() {
    setLoading(true)
    const r = await getCashBook({ from, to })
    setTransactions(r.data); setBalance(r.current_balance); setLoading(false)
  }

  function openAdd() { setEditItem(null); setForm(BLANK); setShowForm(true) }
  function openEdit(t) {
    setEditItem(t)
    setForm({
      transaction_date: t.transaction_date,
      transaction_type: t.transaction_type,
      description: t.description,
      amount: Math.abs(t.amount)
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setForm(BLANK) }

  async function submit(e) {
    e.preventDefault()
    const isOut = form.transaction_type === 'payment'
    try {
      if (editItem) {
        await updateCashTransaction(editItem.id, {
          transaction_date: form.transaction_date,
          transaction_type: form.transaction_type,
          description: form.description,
          amount: isOut ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount))
        })
        toast.success('Transaction updated')
      } else {
        await addCashTransaction({ ...form, is_inflow: !isOut, amount: Number(form.amount) }, user?.uid)
        toast.success('Transaction recorded')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDelete(t) {
    if (!window.confirm(`Delete this cash entry?\n"${t.description}" — ${fmt(Math.abs(t.amount))}`)) return
    try { await deleteCashTransaction(t.id); toast.success('Entry deleted'); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  const totalIn = transactions.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0)
  const totalOut = transactions.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)

  const TYPE_COLORS = { sale:'var(--success)', purchase:'var(--danger)', expense:'var(--danger)', salary:'var(--danger)', receipt:'var(--success)', payment:'var(--danger)', other:'var(--text-muted)' }

  const isManual = t => ['receipt','payment','other'].includes(t.transaction_type)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>💵 Cash Book</h1><p>All cash transactions and current balance</p></div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Cash Balance</div>
            <div style={{fontSize:24,fontWeight:800,color:'var(--success)'}}>{fmt(balance)}</div>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>➕ Add Entry</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
        {[
          { label:'Cash In', val: fmt(totalIn), color:'var(--success)', icon:'📥' },
          { label:'Cash Out', val: fmt(totalOut), color:'var(--danger)', icon:'📤' },
          { label:'Net', val: fmt(totalIn-totalOut), color: totalIn>=totalOut ? 'var(--success)':'var(--danger)', icon:'💵' },
        ].map(s=>(
          <div key={s.label} className="card">
            <div className="card-body" style={{display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontSize:28}}>{s.icon}</span>
              <div><div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.val}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
        <input type="date" className="form-control" style={{width:'auto'}} value={from} onChange={e=>setFrom(e.target.value)}/>
        <span style={{color:'var(--text-muted)'}}>to</span>
        <input type="date" className="form-control" style={{width:'auto'}} value={to} onChange={e=>setTo(e.target.value)}/>
        <span style={{fontSize:12,color:'var(--text-muted)',marginLeft:8}}>{transactions.length} entries</span>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : transactions.length===0
              ? <div className="empty-state"><div className="empty-state-icon">💵</div><h3>No transactions in this range</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr>
                  <th>Date</th><th>Type</th><th>Description</th>
                  <th style={{textAlign:'right'}}>In</th><th style={{textAlign:'right'}}>Out</th>
                  <th style={{textAlign:'right'}}>Balance</th><th></th>
                </tr></thead>
                <tbody>{transactions.map(t=>(
                  <tr key={t.id}>
                    <td style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{t.transaction_date}</td>
                    <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:`${TYPE_COLORS[t.transaction_type]||'var(--text-muted)'}22`,color:TYPE_COLORS[t.transaction_type]||'var(--text-muted)',fontWeight:600,textTransform:'uppercase'}}>{t.transaction_type}</span></td>
                    <td style={{fontWeight:500}}>{t.description}</td>
                    <td style={{textAlign:'right',color:'var(--success)',fontWeight:t.amount>0?700:400}}>{t.amount>0?fmt(t.amount):'—'}</td>
                    <td style={{textAlign:'right',color:'var(--danger)',fontWeight:t.amount<0?700:400}}>{t.amount<0?fmt(Math.abs(t.amount)):'—'}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:t.balance_after>=0?'var(--text-primary)':'var(--danger)'}}>{fmt(t.balance_after)}</td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        {isManual(t) && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(t)} title="Edit">✏️</button>}
                        <button
                          className="btn btn-sm"
                          style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}}
                          onClick={() => handleDelete(t)}
                          title="Delete"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? '✏️ Edit Cash Entry' : '💵 Manual Cash Entry'}</span>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.transaction_date} onChange={e=>setForm(p=>({...p,transaction_date:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">Type</label>
                  <select className="form-control" value={form.transaction_type} onChange={e=>setForm(p=>({...p,transaction_type:e.target.value}))}>
                    <option value="receipt">Receipt (Money In)</option>
                    <option value="payment">Payment (Money Out)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Description *</label>
                  <input className="form-control" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} required/>
                </div>
                <div className="form-group"><label className="form-label">Amount *</label>
                  <input type="number" className="form-control" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} step="0.01" min="0" required/>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? '💾 Update' : '✅ Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
