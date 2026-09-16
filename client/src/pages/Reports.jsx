import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`
const PERIODS = ['today','yesterday','this_week','this_month','last_month','this_year','custom']
const PIE_COLORS = ['#7C3AED','#06B6D4','#10B981','#F59E0B','#EF4444']

const REPORTS = [
  { key:'daily', label:'📅 Daily Summary', desc:'Complete day overview' },
  { key:'sales', label:'🛒 Sales Report', desc:'Bills, amounts, payment modes' },
  { key:'profit', label:'📈 Profit & Loss', desc:'Gross and net profit' },
  { key:'profit-margin', label:'💹 Margin Analysis', desc:'Per product margins' },
  { key:'stock', label:'📦 Stock Report', desc:'Current inventory valuation' },
  { key:'expenses', label:'💸 Expense Report', desc:'Category-wise spending' },
  { key:'credit-outstanding', label:'💳 Credit Outstanding', desc:'Customer pending payments' },
  { key:'product-performance', label:'🏆 Product Performance', desc:'Top selling products' },
  { key:'category-performance', label:'🗂 Category Performance', desc:'Sales by category' },
  { key:'salary', label:'💰 Salary Report', desc:'Monthly payroll summary' },
  { key:'cash-flow', label:'💵 Cash Flow', desc:'Money in and out' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',fontSize:12}}>
      <p style={{color:'var(--text-muted)',marginBottom:4}}>{label}</p>
      {payload.map((p,i)=><p key={i} style={{color:p.color||'var(--text-primary)',fontWeight:600}}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  )
}

export default function Reports() {
  const [selected, setSelected] = useState('daily')
  const [period, setPeriod] = useState('this_month')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().substring(0,7))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [selected, period, from, to, month])

  async function load() {
    setLoading(true)
    try {
      const params = selected==='salary' ? { month } : { period, from: period==='custom'?from:undefined, to: period==='custom'?to:undefined }
      const r = await api.get(`/reports/${selected}`, { params })
      setData(r.data)
    } catch { setData(null) } finally { setLoading(false) }
  }

  const report = REPORTS.find(r=>r.key===selected)

  return (
    <div>
      <div className="page-header"><h1>📊 Reports</h1><p>Business intelligence and analytics</p></div>
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:16}}>
        {/* Sidebar */}
        <div className="card" style={{alignSelf:'start'}}>
          <div className="card-body" style={{padding:'8px 0'}}>
            {REPORTS.map(r=>(
              <div key={r.key} className={`nav-item ${selected===r.key?'active':''}`} style={{padding:'10px 16px',cursor:'pointer'}} onClick={()=>setSelected(r.key)}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{r.label}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:16,marginRight:8}}>{report?.label}</span>
            {selected !== 'salary' && PERIODS.map(p=>(
              <button key={p} className={`date-filter-btn ${period===p?'active':''}`} onClick={()=>setPeriod(p)}>
                {p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
              </button>
            ))}
            {selected==='salary' && <input type="month" className="form-control" style={{width:'auto'}} value={month} onChange={e=>setMonth(e.target.value)}/>}
            {period==='custom' && selected!=='salary' && <>
              <input type="date" className="form-control" style={{width:'auto'}} value={from} onChange={e=>setFrom(e.target.value)}/>
              <input type="date" className="form-control" style={{width:'auto'}} value={to} onChange={e=>setTo(e.target.value)}/>
            </>}
          </div>

          {loading ? <div className="loading-overlay" style={{height:300}}><span className="loading-spinner" style={{width:32,height:32}}/></div>
            : !data ? <div className="empty-state"><div className="empty-state-icon">📊</div><h3>No data available</h3></div>
            : (
            <>
              {/* Daily Summary */}
              {selected==='daily' && data && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    { label:'Total Sales', val:fmt(data.total_sales), color:'var(--primary-light)' },
                    { label:'Bills', val:data.bills, color:'var(--accent)', noRs:true },
                    { label:'Cash Sales', val:fmt(data.cash_sales), color:'var(--success)' },
                    { label:'UPI Sales', val:fmt(data.upi_sales), color:'var(--info)' },
                    { label:'Credit Sales', val:fmt(data.credit_sales), color:'var(--warning)' },
                    { label:'Purchases', val:fmt(data.purchases), color:'var(--danger)' },
                    { label:'Expenses', val:fmt(data.expenses), color:'var(--danger)' },
                    { label:'Gross Profit', val:fmt(data.gross_profit), color:'var(--success)' },
                    { label:'Customer O/S', val:fmt(data.customer_outstanding), color:'var(--warning)' },
                  ].map(s=>(
                    <div key={s.label} className="kpi-card" style={{'--kpi-color':s.color}}>
                      <div className="kpi-label">{s.label}</div>
                      <div className="kpi-value" style={{color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sales Report */}
              {selected==='sales' && data.summary && (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                    {[['Total Sales',data.summary.total_sales,'var(--primary-light)'],['Bills',data.summary.total_bills,'var(--accent)',true],['Discount',data.summary.total_discount,'var(--warning)'],['Tax',data.summary.total_tax,'var(--info)']].map(([l,v,c,nr])=>(
                      <div key={l} className="kpi-card" style={{'--kpi-color':c}}><div className="kpi-label">{l}</div><div className="kpi-value" style={{color:c}}>{nr?v:fmt(v)}</div></div>
                    ))}
                  </div>
                  <div className="card"><div className="card-body" style={{padding:0}}>
                    <div className="table-container"><table className="table">
                      <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                      <tbody>{data.data?.slice(0,50).map(s=>(
                        <tr key={s.id}><td style={{fontWeight:600,color:'var(--primary-light)'}}>{s.invoice_number}</td><td style={{fontSize:12,color:'var(--text-muted)'}}>{s.sale_date||s.created_at?.split('T')[0]}</td><td>{s.customer_name||'Walk-in'}</td><td><span className="badge badge-info">{(s.payment_mode||'').toUpperCase()}</span></td><td style={{textAlign:'right',fontWeight:700}}>{fmt(s.total_amount)}</td></tr>
                      ))}</tbody>
                    </table></div>
                  </div></div>
                </>
              )}

              {/* Profit */}
              {selected==='profit' && data.summary && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div className="card"><div className="card-body">
                    {[['Revenue',data.summary.total_revenue,'var(--primary-light)'],['Cost of Goods',data.summary.total_cost,'var(--danger)'],['Gross Profit',data.summary.gross_profit,'var(--success)'],['Expenses',data.summary.expenses,'var(--danger)'],['Net Profit',data.summary.net_profit,data.summary.net_profit>=0?'var(--success)':'var(--danger)']].map(([l,v,c])=>(
                      <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                        <span style={{fontSize:14,color:'var(--text-secondary)'}}>{l}</span>
                        <span style={{fontWeight:800,fontSize:15,color:c}}>{fmt(v)}</span>
                      </div>
                    ))}
                  </div></div>
                  <div className="card"><div className="card-header"><span className="card-title">Profit by Day</span></div><div className="card-body">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.data?.slice(0,15)} margin={{left:-20}}>
                        <XAxis dataKey="invoice_number" tick={{fontSize:9}} hide/>
                        <YAxis tick={{fontSize:10,fill:'#64748B'}} tickFormatter={v=>`₹${v>=1000?(v/1000).toFixed(0)+'k':v}`}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="gross_profit" fill="#10B981" radius={[4,4,0,0]} name="Profit"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div></div>
                </div>
              )}

              {/* Stock */}
              {selected==='stock' && (
                <>
                  {data.summary && <div className="alert alert-info" style={{marginBottom:16}}>Total Stock Value: <strong>{fmt(data.summary.total_value)}</strong> across <strong>{data.summary.total_products}</strong> products</div>}
                  <div className="card"><div className="card-body" style={{padding:0}}>
                    <div className="table-container"><table className="table">
                      <thead><tr><th>Product</th><th>Category</th><th style={{textAlign:'right'}}>Stock</th><th style={{textAlign:'right'}}>Purchase</th><th style={{textAlign:'right'}}>Selling</th><th style={{textAlign:'right'}}>Stock Value</th></tr></thead>
                      <tbody>{data.data?.map(p=>(
                        <tr key={p.product_code}><td style={{fontWeight:600}}>{p.name}</td><td style={{fontSize:12}}>{p.category||'—'}</td><td style={{textAlign:'right',fontWeight:700,color:p.quantity<=0?'var(--danger)':'var(--success)'}}>{p.quantity}</td><td style={{textAlign:'right',fontSize:12}}>{fmt(p.purchase_price)}</td><td style={{textAlign:'right',fontSize:12}}>{fmt(p.selling_price)}</td><td style={{textAlign:'right',fontWeight:700}}>{fmt(p.stock_value)}</td></tr>
                      ))}</tbody>
                    </table></div>
                  </div></div>
                </>
              )}

              {/* Product Performance */}
              {selected==='product-performance' && (
                <div className="card"><div className="card-body" style={{padding:0}}>
                  <div className="table-container"><table className="table">
                    <thead><tr><th>#</th><th>Product</th><th style={{textAlign:'right'}}>Qty Sold</th><th style={{textAlign:'right'}}>Revenue</th><th style={{textAlign:'right'}}>Profit</th><th style={{textAlign:'right'}}>Stock</th></tr></thead>
                    <tbody>{data.data?.map((p,i)=>(
                      <tr key={i}><td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td><td style={{fontWeight:600}}>{p.product_name}</td><td style={{textAlign:'right',fontWeight:700}}>{p.qty_sold}</td><td style={{textAlign:'right',color:'var(--primary-light)',fontWeight:700}}>{fmt(p.revenue)}</td><td style={{textAlign:'right',color:'var(--success)',fontWeight:700}}>{fmt(p.profit)}</td><td style={{textAlign:'right',fontSize:12}}>{p.current_stock}</td></tr>
                    ))}</tbody>
                  </table></div>
                </div></div>
              )}

              {/* Expenses */}
              {selected==='expenses' && data && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>
                  <div className="card"><div className="card-body" style={{padding:0}}>
                    <div className="table-container"><table className="table">
                      <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                      <tbody>{data.data?.slice(0,50).map(e=>(
                        <tr key={e.id}><td style={{fontSize:12,color:'var(--text-muted)'}}>{e.expense_date}</td><td style={{fontSize:12}}>{e.category||'—'}</td><td>{e.description}</td><td style={{textAlign:'right',fontWeight:700,color:'var(--danger)'}}>{fmt(e.amount)}</td></tr>
                      ))}</tbody>
                    </table></div>
                  </div></div>
                  <div className="card"><div className="card-header"><span className="card-title">By Category</span></div><div className="card-body">
                    {data.by_category?.length>0 && <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart><Pie data={data.by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                          {data.by_category.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                        </Pie><Tooltip formatter={v=>fmt(v)}/></PieChart>
                      </ResponsiveContainer>
                      {data.by_category.map((c,i)=>(
                        <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:6}}>
                          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}></span>{c.category}</span>
                          <span style={{fontWeight:700}}>{fmt(c.total)}</span>
                        </div>
                      ))}
                    </>}
                    <div style={{marginTop:16,padding:'12px 0',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',fontWeight:700}}>
                      <span>Total</span><span style={{color:'var(--danger)'}}>{fmt(data.total)}</span>
                    </div>
                  </div></div>
                </div>
              )}

              {/* Salary */}
              {selected==='salary' && (
                <div className="card"><div className="card-body" style={{padding:0}}>
                  <div className="table-container"><table className="table">
                    <thead><tr><th>Employee</th><th>Designation</th><th style={{textAlign:'right'}}>Base</th><th style={{textAlign:'right'}}>Net Salary</th><th>Status</th></tr></thead>
                    <tbody>{data.data?.map(s=>(
                      <tr key={s.id}><td style={{fontWeight:600}}>{s.employee_name}</td><td style={{fontSize:12,color:'var(--text-muted)'}}>{s.designation||'—'}</td><td style={{textAlign:'right'}}>{fmt(s.base_salary)}</td><td style={{textAlign:'right',fontWeight:700,fontSize:15}}>{fmt(s.net_salary)}</td><td><span className={`badge ${s.status==='paid'?'badge-success':'badge-warning'}`}>{s.status}</span></td></tr>
                    ))}</tbody>
                    {data.summary && <tfoot><tr><td colSpan={3} style={{textAlign:'right',fontWeight:600,color:'var(--text-muted)'}}>Total Payroll:</td><td style={{textAlign:'right',fontWeight:800,fontSize:16,color:'var(--primary-light)'}}>{fmt(data.summary.total)}</td><td/></tr></tfoot>}
                  </table></div>
                </div></div>
              )}

              {/* Generic fallback */}
              {!['daily','sales','profit','stock','product-performance','expenses','salary'].includes(selected) && data?.data && (
                <div className="card"><div className="card-body">
                  <pre style={{fontSize:12,color:'var(--text-secondary)',overflow:'auto',maxHeight:400}}>{JSON.stringify(data,null,2)}</pre>
                </div></div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
