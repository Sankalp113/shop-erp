import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategoriesTree, getProducts, deleteProduct } from '../../services/db'
import toast from 'react-hot-toast'
import { useRefresh } from '../../context/RefreshContext'


export default function Products() {
  const navigate = useNavigate()
  const { version, refresh } = useRefresh()
  const [products, setProducts] = useState([])

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catId, setCatId] = useState('')
  const [catTree, setCatTree] = useState({ parents: [], children: {}, all: [] })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => { getCategoriesTree().then(setCatTree) }, [])
  useEffect(() => { load() }, [search, catId, page, version.products, version.stock])


  async function load() {
    setLoading(true)
    // If catId is a parent category, include all its subcategory products too
    const catIds = (() => {
      if (!catId) return null
      const subs = catTree.children[catId]
      if (subs && subs.length > 0) return [catId, ...subs.map(s => s.id)]
      return null
    })()
    const r = await getProducts({ search, category_id: catIds ? '' : catId, category_ids: catIds, limit: 50 })
    setProducts(r.data); setTotal(r.total); setLoading(false)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>🏷️ Products</h1><p>Manage your clothing catalog — {total} products</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/products/new')}>➕ Add Product</button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input className="form-control" placeholder="🔍 Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ flex: 1 }} />
        <select className="form-control" value={catId} onChange={e => { setCatId(e.target.value); setPage(1) }} style={{ width: 200 }}>
          <option value="">All Categories</option>
          {catTree.parents.map(parent => {
            const subs = catTree.children[parent.id] || []
            return subs.length > 0 ? (
              <optgroup key={parent.id} label={`📁 ${parent.name}`}>
                <option value={parent.id}>{parent.name} (All)</option>
                {subs.map(s => <option key={s.id} value={s.id}>&nbsp;&nbsp;└ {s.name}</option>)}
              </optgroup>
            ) : (
              <option key={parent.id} value={parent.id}>📁 {parent.name}</option>
            )
          })}
          {catTree.all?.filter(c => c.parent_id && !catTree.parents.find(p => p.id === c.parent_id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : products.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">👕</div><h3>No products found</h3><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/products/new')}>Add First Product</button></div>
              : <div className="table-container"><table className="table">
                <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Brand</th><th style={{ textAlign: 'right' }}>Purchase</th><th style={{ textAlign: 'right' }}>Selling</th><th style={{ textAlign: 'right' }}>Stock</th><th>Status</th><th></th></tr></thead>
                <tbody>{products.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.product_code}</td>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{p.brand_name || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>₹{p.purchase_price?.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>₹{p.selling_price?.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: p.total_stock <= p.min_stock_level ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{p.total_stock}</span>
                    </td>
                    <td><span className={`badge ${p.is_active ? 'badge-success' : 'badge-muted'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><div style={{display:'flex',gap:4}}><button className="btn btn-sm btn-secondary" onClick={() => navigate(`/products/${p.id}/edit`)}>✏️</button><button className="btn btn-sm" style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'}} onClick={async()=>{if(!window.confirm(`Delete product "${p.name}"?`))return;try{await deleteProduct(p.id);toast.success('Product deleted');refresh('products','stock');load()}catch(e){toast.error(e.message)}}}>🗑️</button></div></td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      </div>
      {total > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page}</span>
          <button className="btn btn-secondary btn-sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
