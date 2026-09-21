import React, { useState, useEffect } from 'react'
import { getAuditLogs } from '../../services/db'

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState('')
  const [from, setFrom] = useState(new Date(Date.now()-7*86400000).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => { load() }, [module, from, to, page])

  async function load() {
    setLoading(true)
    const r = await getAuditLogs({ module, from, to, limit: 100 })
    setLogs(r.data); setTotal(r.total); setLoading(false)
  }

  const ACTION_COLORS = { CREATE_SALE:'var(--success)', CREATE_PURCHASE:'var(--accent)', UPDATE_PRODUCT:'var(--warning)', DELETE:'var(--danger)', CREATE_EXPENSE:'var(--warning)', LOGIN:'var(--info)' }
  const getColor = action => { for (const [k,v] of Object.entries(ACTION_COLORS)) { if (action?.includes(k.split('_').pop())) return v } return 'var(--text-muted)' }

  return (
    <div>
      <div className="page-header"><h1>🔍 Audit Log</h1><p>Complete trail of all system actions</p></div>
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <input type="date" className="form-control" style={{width:'auto'}} value={from} onChange={e=>{setFrom(e.target.value);setPage(1)}}/>
        <input type="date" className="form-control" style={{width:'auto'}} value={to} onChange={e=>{setTo(e.target.value);setPage(1)}}/>
        <select className="form-control" style={{width:180}} value={module} onChange={e=>{setModule(e.target.value);setPage(1)}}>
          <option value="">All Modules</option>
          {['sales','purchases','products','customers','vendors','expenses','finance','staff','users','settings'].map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{fontSize:13,color:'var(--text-muted)',alignSelf:'center',marginLeft:'auto'}}>{total} entries</span>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : logs.length===0
              ? <div className="empty-state"><div className="empty-state-icon">🔍</div><h3>No audit logs in this range</h3></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>IP</th></tr></thead>
                <tbody>{logs.map(l=>(
                  <tr key={l.id}>
                    <td style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{l.created_at?.replace('T',' ').slice(0,19)}</td>
                    <td style={{fontWeight:600,fontSize:13}}>{l.username}</td>
                    <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:`${getColor(l.action)}22`,color:getColor(l.action),fontWeight:600}}>{l.action}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.module}</td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{l.record_id||'—'}</td>
                    <td style={{fontSize:11,color:'var(--text-muted)',fontFamily:'monospace'}}>{l.ip_address||'—'}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>

      {total > 100 && (
        <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:16}}>
          <button className="btn btn-secondary btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{fontSize:13,color:'var(--text-muted)',alignSelf:'center'}}>Page {page} / {Math.ceil(total/100)}</span>
          <button className="btn btn-secondary btn-sm" disabled={page*100>=total} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
