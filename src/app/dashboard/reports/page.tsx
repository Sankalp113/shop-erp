'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, currentMonth } from '@/lib/utils'
import { BarChart3, TrendingUp, ShoppingBag, DollarSign, Users, Package } from 'lucide-react'

type ReportType = 'sales' | 'purchases' | 'expenses' | 'profit' | 'customers' | 'products'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('sales')
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Record<string,number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let rows: any[] = []
      if (reportType === 'sales') {
        const snap = await getDocs(query(collection(db,'sales'), where('saleDate','>=',`${month}-01`), where('saleDate','<=',`${month}-31`), orderBy('saleDate','desc')))
        rows = snap.docs.map(d=>({id:d.id,...d.data()}))
        setSummary({
          total: rows.reduce((s,r)=>s+(r.totalAmount||0),0),
          cash: rows.reduce((s,r)=>s+(r.cashAmount||0),0),
          upi: rows.reduce((s,r)=>s+(r.upiAmount||0),0),
          card: rows.reduce((s,r)=>s+(r.cardAmount||0),0),
          credit: rows.reduce((s,r)=>s+(r.creditAmount||0),0),
          count: rows.length,
          profit: rows.reduce((s,r)=>s+(r.totalAmount||0)-(r.totalCost||0),0),
        })
      } else if (reportType === 'expenses') {
        const snap = await getDocs(query(collection(db,'expenses'), where('expenseDate','>=',`${month}-01`), where('expenseDate','<=',`${month}-31`), orderBy('expenseDate','desc')))
        rows = snap.docs.map(d=>({id:d.id,...d.data()}))
        setSummary({ total: rows.reduce((s,r)=>s+(r.amount||0),0), count: rows.length })
      } else if (reportType === 'purchases') {
        const snap = await getDocs(query(collection(db,'purchases'), where('purchaseDate','>=',`${month}-01`), where('purchaseDate','<=',`${month}-31`), orderBy('purchaseDate','desc')))
        rows = snap.docs.map(d=>({id:d.id,...d.data()}))
        setSummary({ total: rows.reduce((s,r)=>s+(r.totalAmount||0),0), count: rows.length, outstanding: rows.reduce((s,r)=>s+(r.outstandingAmount||0),0) })
      } else if (reportType === 'customers') {
        const snap = await getDocs(query(collection(db,'customers'), where('outstanding','>',0), orderBy('outstanding','desc')))
        rows = snap.docs.map(d=>({id:d.id,...d.data()}))
        setSummary({ total: rows.reduce((s,r)=>s+(r.outstanding||0),0), count: rows.length })
      }
      setData(rows)
    } catch {}
    setLoading(false)
  }, [reportType, month])

  useEffect(()=>{ load() },[load])

  const REPORTS = [
    { id:'sales', label:'Sales Report', icon:<ShoppingBag size={16}/> },
    { id:'purchases', label:'Purchase Report', icon:<Package size={16}/> },
    { id:'expenses', label:'Expense Report', icon:<DollarSign size={16}/> },
    { id:'customers', label:'Customer Outstanding', icon:<Users size={16}/> },
  ]

  function renderTable() {
    if (reportType==='sales') return (
      <table className="data-table">
        <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Mode</th><th className="text-right">Amount</th><th className="text-right">Profit</th></tr></thead>
        <tbody>{data.map(r=><tr key={r.id}><td className="font-mono text-violet-300">{r.invoiceNumber}</td><td>{formatDate(r.saleDate)}</td><td>{r.customerName||'Walk-in'}</td><td className="capitalize">{r.paymentMode}</td><td className="text-right font-bold">{formatCurrency(r.totalAmount)}</td><td className="text-right text-emerald-300">{formatCurrency((r.totalAmount||0)-(r.totalCost||0))}</td></tr>)}</tbody>
      </table>
    )
    if (reportType==='expenses') return (
      <table className="data-table">
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Mode</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{data.map(r=><tr key={r.id}><td>{formatDate(r.expenseDate)}</td><td>{r.categoryName||'—'}</td><td>{r.description}</td><td className="capitalize">{r.paymentMode}</td><td className="text-right font-bold text-red-300">{formatCurrency(r.amount)}</td></tr>)}</tbody>
      </table>
    )
    if (reportType==='purchases') return (
      <table className="data-table">
        <thead><tr><th>Purchase #</th><th>Date</th><th>Vendor</th><th className="text-right">Total</th><th className="text-right">Outstanding</th><th>Status</th></tr></thead>
        <tbody>{data.map(r=><tr key={r.id}><td className="font-mono text-violet-300">{r.purchaseNumber}</td><td>{formatDate(r.purchaseDate)}</td><td>{r.vendorName||'—'}</td><td className="text-right font-bold">{formatCurrency(r.totalAmount)}</td><td className={`text-right font-bold ${(r.outstandingAmount||0)>0?'text-amber-300':''}`}>{formatCurrency(r.outstandingAmount||0)}</td><td><span className={`badge ${r.status==='paid'?'badge-success':r.status==='partial'?'badge-warning':'badge-danger'}`}>{r.status}</span></td></tr>)}</tbody>
      </table>
    )
    if (reportType==='customers') return (
      <table className="data-table">
        <thead><tr><th>Customer</th><th>Mobile</th><th className="text-right">Credit Limit</th><th className="text-right">Outstanding</th></tr></thead>
        <tbody>{data.map(r=><tr key={r.id}><td className="font-semibold text-gray-200">{r.name}</td><td>{r.mobile||'—'}</td><td className="text-right">{formatCurrency(r.creditLimit||0)}</td><td className="text-right font-bold text-amber-300">{formatCurrency(r.outstanding||0)}</td></tr>)}</tbody>
      </table>
    )
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Business intelligence & analytics</p></div>
        <input type="month" className="form-input w-auto" value={month} onChange={e=>setMonth(e.target.value)}/>
      </div>

      <div className="tabs mb-5">
        {REPORTS.map(r=>(
          <button key={r.id} className={`tab flex items-center gap-1.5 ${reportType===r.id?'active':''}`} onClick={()=>setReportType(r.id as ReportType)}>
            {r.icon}{r.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {summary.total !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#7C3AED'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Total</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(summary.total)}</p></div>}
          {summary.count !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#06B6D4'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Count</p><p className="text-xl font-bold text-white mt-1">{summary.count}</p></div>}
          {summary.profit !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#10B981'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Gross Profit</p><p className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(summary.profit)}</p></div>}
          {summary.outstanding !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#F59E0B'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</p><p className="text-xl font-bold text-amber-300 mt-1">{formatCurrency(summary.outstanding)}</p></div>}
          {summary.cash !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#10B981'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Cash</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(summary.cash)}</p></div>}
          {summary.upi !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#06B6D4'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">UPI</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(summary.upi)}</p></div>}
          {summary.credit !== undefined && <div className="kpi-card" style={{'--kpi-accent':'#F59E0B'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Credit</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(summary.credit)}</p></div>}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {loading ? <div className="loading-overlay"><div className="spinner spinner-lg"/></div>
          : data.length===0 ? <div className="empty-state py-12"><BarChart3 size={48} className="opacity-20 mb-4"/><p>No data for selected period</p></div>
            : <div className="table-wrap">{renderTable()}</div>}
      </div>
    </div>
  )
}
