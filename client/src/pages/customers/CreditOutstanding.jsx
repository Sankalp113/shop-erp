import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function CreditOutstanding() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    api.get('/reports/credit-outstanding').then(r => {
      setData(r.data.data); setTotal(r.data.total)
    }).finally(() => setLoading(false))
  }, [])

  const urgencyColor = days => days > 90 ? 'var(--danger)' : days > 60 ? 'var(--warning)' : 'var(--text-secondary)'

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>💳 Credit Outstanding</h1><p>All customers with pending credit payments</p></div>
        <div className="stat-chip" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}}>
          <span style={{fontSize:20,fontWeight:800,color:'var(--danger)'}}>{fmt(total)}</span>
          <span className="stat-chip-label">Total Outstanding</span>
        </div>
      </div>

      {data.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
          {[
            { label:'0–30 Days', count: data.filter(d=>d.days_outstanding<=30).length, color:'var(--success)' },
            { label:'31–60 Days', count: data.filter(d=>d.days_outstanding>30&&d.days_outstanding<=60).length, color:'var(--warning)' },
            { label:'60+ Days', count: data.filter(d=>d.days_outstanding>60).length, color:'var(--danger)' },
          ].map(s => (
            <div key={s.label} className="card">
              <div className="card-body" style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.count}</div>
                <div style={{fontSize:13,color:'var(--text-muted)'}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : data.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">✅</div><h3>No outstanding credit</h3><p>All customer payments are cleared!</p></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Customer</th><th>Mobile</th><th style={{textAlign:'right'}}>Pending Bills</th><th style={{textAlign:'center'}}>Days Outstanding</th><th style={{textAlign:'right'}}>Outstanding Amount</th><th></th></tr></thead>
                <tbody>{data.map(c => (
                  <tr key={c.id}>
                    <td style={{fontWeight:600,color:'var(--text-primary)'}}>{c.name}</td>
                    <td style={{fontSize:12}}>{c.mobile||'—'}</td>
                    <td style={{textAlign:'right'}}>{c.pending_bills}</td>
                    <td style={{textAlign:'center'}}>
                      <span style={{color: urgencyColor(c.days_outstanding), fontWeight:700}}>{c.days_outstanding}</span>
                      {c.days_outstanding > 60 && <span style={{marginLeft:4,fontSize:11}}>⚠️</span>}
                    </td>
                    <td style={{textAlign:'right',fontWeight:800,fontSize:16,color:'var(--danger)'}}>{fmt(c.outstanding)}</td>
                    <td><button className="btn btn-sm btn-warning" onClick={() => navigate(`/customers/${c.id}`)}>Collect →</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
    </div>
  )
}
