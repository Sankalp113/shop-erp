'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency } from '@/lib/utils'
import { Package, AlertTriangle } from 'lucide-react'

export default function StockOverviewPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'low'|'out'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db,'products'), where('isActive','==',true), orderBy('name')))
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Load variants for products that have them
      const withVariants = await Promise.all(prods.map(async (p: any) => {
        if (p.hasVariants) {
          const varSnap = await getDocs(collection(db,'products',p.id,'variants'))
          return { ...p, variants: varSnap.docs.map(d=>({id:d.id,...d.data()})) }
        }
        return p
      }))
      setProducts(withVariants)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(()=>{load()},[load])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name?.toLowerCase().includes(q)
    const stock = p.hasVariants ? (p.variants?.reduce((s:number,v:any)=>s+(v.currentStock||0),0)||0) : (p.currentStock||0)
    const min = p.minStock||5
    if (filter==='low') return matchSearch && stock > 0 && stock <= min
    if (filter==='out') return matchSearch && stock === 0
    return matchSearch
  })

  const totalValue = products.reduce((s,p) => {
    const stock = p.hasVariants ? (p.variants?.reduce((ss:number,v:any)=>ss+(v.currentStock||0),0)||0) : (p.currentStock||0)
    return s + stock * (p.purchasePrice||0)
  },0)

  const lowCount = products.filter(p => {
    const stock = p.hasVariants ? (p.variants?.reduce((s:number,v:any)=>s+(v.currentStock||0),0)||0) : (p.currentStock||0)
    return stock <= (p.minStock||5) && stock > 0
  }).length

  const outCount = products.filter(p => {
    const stock = p.hasVariants ? (p.variants?.reduce((s:number,v:any)=>s+(v.currentStock||0),0)||0) : (p.currentStock||0)
    return stock === 0
  }).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Stock Overview</h1>
          <p className="page-subtitle">Inventory value: {formatCurrency(totalValue)} · {lowCount} low · {outCount} out of stock</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="kpi-card" style={{'--kpi-accent':'#7C3AED'} as any}><p className="text-xs text-gray-500 uppercase">Total Products</p><p className="text-xl font-bold text-white mt-1">{products.length}</p></div>
        <div className="kpi-card" style={{'--kpi-accent':'#F59E0B'} as any}><p className="text-xs text-gray-500 uppercase">Low Stock</p><p className="text-xl font-bold text-amber-300 mt-1">{lowCount}</p></div>
        <div className="kpi-card" style={{'--kpi-accent':'#EF4444'} as any}><p className="text-xs text-gray-500 uppercase">Out of Stock</p><p className="text-xl font-bold text-red-300 mt-1">{outCount}</p></div>
      </div>

      <div className="glass-card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <input className="form-input" placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="tabs !mb-0">
          {(['all','low','out'] as const).map(f=><button key={f} className={`tab ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'All':f==='low'?'⚠️ Low Stock':'❌ Out of Stock'}</button>)}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Category</th><th>Purchase ₹</th><th>Selling ₹</th><th className="text-right">Min Stock</th><th className="text-right">Current Stock</th><th>Status</th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={7} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
              :filtered.length===0?<tr><td colSpan={7}><div className="empty-state"><Package size={40} className="opacity-30 mb-3"/><p>No products found</p></div></td></tr>
              :filtered.map(p => {
                const stock = p.hasVariants ? (p.variants?.reduce((s:number,v:any)=>s+(v.currentStock||0),0)||0) : (p.currentStock||0)
                const min = p.minStock||5
                const isLow = stock > 0 && stock <= min
                const isOut = stock === 0
                return (
                  <tr key={p.id}>
                    <td><div className="font-semibold text-gray-200">{p.name}</div><div className="text-xs text-gray-600">{p.code||''}</div></td>
                    <td>{p.categoryName||'—'}</td>
                    <td>{formatCurrency(p.purchasePrice||0)}</td>
                    <td className="font-semibold">{formatCurrency(p.sellingPrice||0)}</td>
                    <td className="text-right">{min}</td>
                    <td className={`text-right text-lg font-bold ${isOut?'text-red-400':isLow?'text-amber-400':'text-emerald-300'}`}>{stock}</td>
                    <td>
                      {isOut?<span className="badge badge-danger">Out of Stock</span>
                      :isLow?<span className="badge badge-warning flex items-center gap-1"><AlertTriangle size={10}/> Low</span>
                      :<span className="badge badge-success">In Stock</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
