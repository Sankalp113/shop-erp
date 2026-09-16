'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, todayStr } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Package, Edit2, X, ChevronRight } from 'lucide-react'
import type { Product, Category, Brand } from '@/types'

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({
    name: '', code: '', sku: '', categoryId: '', brandId: '',
    purchasePrice: '', sellingPrice: '', mrp: '', taxRate: '0',
    discountPercent: '0', minStock: '5', description: '', isActive: true
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pSnap, cSnap, bSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), orderBy('name'))),
        getDocs(query(collection(db, 'categories'), orderBy('name'))),
        getDocs(query(collection(db, 'brands'), orderBy('name'))),
      ])
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Product))
      setCategories(cSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Category))
      setBrands(bSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Brand))
    } catch { toast.error('Failed to load — check Firebase config') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  function openAdd() {
    setEditProduct(null)
    setForm({ name:'',code:'',sku:'',categoryId:'',brandId:'',purchasePrice:'',sellingPrice:'',mrp:'',taxRate:'0',discountPercent:'0',minStock:'5',description:'',isActive:true })
    setShowForm(true)
  }
  function openEdit(p: Product) { setEditProduct(p); setForm({ ...p, purchasePrice: String(p.purchasePrice), sellingPrice: String(p.sellingPrice), mrp: String(p.mrp||''), taxRate: String(p.taxRate||0), discountPercent: String(p.discountPercent||0), minStock: String(p.minStock||5) } as any); setShowForm(true) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.sellingPrice) return toast.error('Name and selling price required')
    const cat = categories.find(c => c.id === form.categoryId)
    const brand = brands.find(b => b.id === form.brandId)
    const data = {
      name: form.name, code: form.code, sku: form.sku,
      categoryId: form.categoryId || null, categoryName: cat?.name || '',
      brandId: form.brandId || null, brandName: brand?.name || '',
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice),
      mrp: Number(form.mrp) || 0,
      taxRate: Number(form.taxRate) || 0,
      discountPercent: Number(form.discountPercent) || 0,
      minStock: Number(form.minStock) || 5,
      description: form.description,
      isActive: form.isActive,
      hasVariants: false,
    }
    try {
      if (editProduct) {
        await updateDoc(doc(db, 'products', editProduct.id), { ...data, updatedAt: serverTimestamp() })
        toast.success('Product updated')
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() })
        toast.success('Product added')
      }
      setShowForm(false); load()
    } catch (err: any) { toast.error(err.message) }
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
    const matchCat = !filterCat || p.categoryId === filterCat
    return matchSearch && matchCat
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Products</h1><p className="page-subtitle">{products.length} total products</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Product</button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="form-input pl-9" placeholder="Search name, code, SKU…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="form-select w-auto" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Product</th><th>Category</th><th>Purchase ₹</th><th>Selling ₹</th>
              <th>Tax%</th><th>Min Stock</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><div className="spinner mx-auto"/></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Package size={40}/></div><p>No products found</p><button className="btn btn-primary btn-sm mt-3" onClick={openAdd}>Add First Product</button></div></td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td><div className="font-semibold text-gray-200">{p.name}</div><div className="text-xs text-gray-600">{p.code||p.sku||'—'}</div></td>
                  <td>{p.categoryName||'—'}</td>
                  <td>{formatCurrency(p.purchasePrice)}</td>
                  <td className="font-semibold text-gray-200">{formatCurrency(p.sellingPrice)}</td>
                  <td>{p.taxRate||0}%</td>
                  <td>{p.minStock||5}</td>
                  <td><span className={`badge ${p.isActive!==false?'badge-success':'badge-muted'}`}>{p.isActive!==false?'Active':'Inactive'}</span></td>
                  <td><button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(p)}><Edit2 size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="modal-title">{editProduct?'Edit Product':'Add Product'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Product Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required /></div>
                  <div><label className="form-label">Product Code / SKU</label><input className="form-input" value={form.code} onChange={e=>set('code',e.target.value)} placeholder="AUTO if blank"/></div>
                </div>
                <div className="form-row">
                  <div><label className="form-label">Category</label>
                    <select className="form-select" value={form.categoryId} onChange={e=>set('categoryId',e.target.value)}>
                      <option value="">Select Category</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><label className="form-label">Brand</label>
                    <select className="form-select" value={form.brandId} onChange={e=>set('brandId',e.target.value)}>
                      <option value="">Select Brand</option>
                      {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row-3">
                  <div><label className="form-label">Purchase Price (₹)</label><input type="number" className="form-input" value={form.purchasePrice} onChange={e=>set('purchasePrice',e.target.value)} min="0" step="0.01"/></div>
                  <div><label className="form-label">Selling Price (₹) *</label><input type="number" className="form-input" value={form.sellingPrice} onChange={e=>set('sellingPrice',e.target.value)} required min="0" step="0.01"/></div>
                  <div><label className="form-label">MRP (₹)</label><input type="number" className="form-input" value={form.mrp} onChange={e=>set('mrp',e.target.value)} min="0" step="0.01"/></div>
                </div>
                <div className="form-row-3">
                  <div><label className="form-label">Tax Rate (%)</label>
                    <select className="form-select" value={form.taxRate} onChange={e=>set('taxRate',e.target.value)}>
                      <option value="0">0% (Exempt)</option><option value="5">5% GST</option><option value="12">12% GST</option><option value="18">18% GST</option>
                    </select>
                  </div>
                  <div><label className="form-label">Discount (%)</label><input type="number" className="form-input" value={form.discountPercent} onChange={e=>set('discountPercent',e.target.value)} min="0" max="100"/></div>
                  <div><label className="form-label">Min Stock Level</label><input type="number" className="form-input" value={form.minStock} onChange={e=>set('minStock',e.target.value)} min="0"/></div>
                </div>
                <div><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e=>set('description',e.target.value)} rows={2}/></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e=>set('isActive',e.target.checked)} className="w-4 h-4 accent-violet-500"/>
                  <span className="text-sm text-gray-300">Active Product</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editProduct?'Update':'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
