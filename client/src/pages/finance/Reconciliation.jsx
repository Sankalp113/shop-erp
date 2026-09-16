import React, { useState, useEffect } from 'react'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function Reconciliation() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [date])

  async function load() {
    setLoading(true)
    const [rec, fin] = await Promise.all([
      api.get('/finance/reconciliation', { params: { date } }),
      api.get('/finance/summary'),
    ])
    setData(rec.data); setSummary(fin.data); setLoading(false)
  }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🔍 Day-End Reconciliation</h1><p>Verify cash and bank balances</p></div>
        <input type="date" className="form-control" style={{width:'auto'}} value={date} onChange={e=>setDate(e.target.value)}/>
      </div>

      {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div> : (
        <>
          {/* Current Balances */}
          {summary && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
              {[
                { label:'Cash Balance', val: fmt(summary.cash_balance), color:'var(--success)', icon:'💵' },
                { label:'Bank Total', val: fmt(summary.total_bank), color:'var(--accent)', icon:'🏦' },
                { label:'Total Liquid', val: fmt(summary.total_liquid), color:'var(--primary-light)', icon:'💰' },
              ].map(s=>(
                <div key={s.label} className="card">
                  <div className="card-body" style={{display:'flex',alignItems:'center',gap:16}}>
                    <span style={{fontSize:32}}>{s.icon}</span>
                    <div><div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{s.label}</div>
                    <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Daily Reconciliation */}
          {data && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div className="card">
                <div className="card-header"><span className="card-title">📅 Cash Reconciliation — {date}</span></div>
                <div className="card-body">
                  {[
                    { label:'Opening Cash', val: data.opening_cash, color:'var(--text-secondary)' },
                    { label:'+ Cash Receipts', val: data.receipts, color:'var(--success)' },
                    { label:'− Cash Payments', val: data.payments, color:'var(--danger)' },
                  ].map((row,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)',fontSize:14}}>
                      <span style={{color:'var(--text-secondary)'}}>{row.label}</span>
                      <span style={{fontWeight:700,color:row.color}}>{fmt(row.val)}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'16px 0 0',fontSize:16,fontWeight:800}}>
                    <span>Expected Closing Cash</span>
                    <span style={{color:'var(--success)'}}>{fmt(data.expected_closing)}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">📊 Business Summary</span></div>
                <div className="card-body">
                  {summary && [
                    { label:'Customer Receivable', val: summary.customer_receivable, color:'var(--warning)' },
                    { label:'Vendor Payable', val: summary.vendor_payable, color:'var(--danger)' },
                    { label:'Month Expenses', val: summary.month_expenses, color:'var(--danger)' },
                  ].map((row,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)',fontSize:14}}>
                      <span style={{color:'var(--text-secondary)'}}>{row.label}</span>
                      <span style={{fontWeight:700,color:row.color}}>{fmt(row.val)}</span>
                    </div>
                  ))}
                  {summary?.bank_accounts?.map(acc=>(
                    <div key={acc.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',fontSize:13}}>
                      <span style={{color:'var(--text-muted)'}}>{acc.account_name}</span>
                      <span style={{fontWeight:600,color:'var(--accent)'}}>{fmt(acc.current_balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
