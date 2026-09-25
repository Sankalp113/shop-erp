import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getCategoriesTree, getBrands, getSizes, getColors, getProduct, createProduct, updateProduct } from '../../services/db'


export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [catTree, setCatTree] = useState({ parents: [], children: {} })

  const [brands, setBrands] = useState([])
  const [sizes, setSizes] = useState([])
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', sku: '', category_id: '', brand_id: '', description: '',
    purchase_price: '', selling_price: '', mrp: '', discount_percent: 0,
    tax_percent: 0, min_stock_level: 5, location: '', has_variants: false, opening_stock: 0
  })
  const [variants, setVariants] = useState([])

  useEffect(() => {
    getCategoriesTree().then(setCatTree)

    getBrands().then(setBrands)
    getSizes().then(setSizes)
    getColors().then(setColors)
    if (isEdit) {
      getProduct(id).then(p => {
        if (!p) return
        setForm({ name: p.name, sku: p.sku || '', category_id: p.category_id || '', brand_id: p.brand_id || '', description: p.description || '', purchase_price: p.purchase_price, selling_price: p.selling_price, mrp: p.mrp || '', discount_percent: p.discount_percent || 0, tax_percent: p.tax_percent || 0, min_stock_level: p.min_stock_level || 5, location: p.location || '', has_variants: p.has_variants === 1, opening_stock: 0 })
        if (p.variants?.length) setVariants(p.variants)
      })
    }
  }, [id])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function addVariant() {
    setVariants(prev => [...prev, { size_id: '', color_id: '', sku: '', purchase_price: form.purchase_price, selling_price: form.selling_price, opening_stock: 0 }])
  }
  function removeVariant(i) { setVariants(prev => prev.filter((_, idx) => idx !== i)) }
  function setVariantField(i, k, v) { setVariants(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name) return toast.error('Product name is required')
    if (!form.selling_price) return toast.error('Selling price is required')
    setLoading(true)
    try {
      const payload = { ...form, variants: form.has_variants ? variants : [] }
      if (isEdit) {
        await updateProduct(id, payload)
        toast.success('Product updated')
      } else {
        await createProduct(payload)
        toast.success('Product created')
      }
      navigate('/products')
    } catch (err) { toast.error(err.message || 'Failed') } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/products')}>← Back</button>
          <h1>{isEdit ? '✏️ Edit Product' : '➕ Add New Product'}</h1>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
          {/* Main Info */}
          <div className="card">
            <div className="card-header"><span className="card-title">Product Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Product Name *</label>
                  <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Men's Formal Shirt" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-control" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                    <option value="">Select category</option>
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
                    {/* Sub-categories without a recognised parent */}
                    {catTree.all?.filter(c => c.parent_id && !catTree.parents.find(p => p.id === c.parent_id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <select className="form-control" value={form.brand_id} onChange={e => set('brand_id', e.target.value)}>
                    <option value="">Select brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input className="form-control" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU code" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rack / Location</label>
                  <input className="form-control" value={form.location} onChange={e => set('location', e.target.value)} placeholder="A-01, Shelf 2..." />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Product details..." rows={3} />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Pricing</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Purchase Price *</label>
                  <input type="number" className="form-control" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price *</label>
                  <input type="number" className="form-control" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div className="form-group">
                  <label className="form-label">MRP</label>
                  <input type="number" className="form-control" value={form.mrp} onChange={e => set('mrp', e.target.value)} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Discount %</label>
                    <input type="number" className="form-control" value={form.discount_percent} onChange={e => set('discount_percent', e.target.value)} min="0" max="100" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tax %</label>
                    <input type="number" className="form-control" value={form.tax_percent} onChange={e => set('tax_percent', e.target.value)} min="0" max="100" />
                  </div>
                </div>
                {form.purchase_price > 0 && form.selling_price > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                    <div style={{ color: 'var(--success)', fontWeight: 700 }}>
                      Margin: ₹{(form.selling_price - form.purchase_price).toFixed(2)} ({((form.selling_price - form.purchase_price) / form.selling_price * 100).toFixed(1)}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Stock</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Min Stock Level</label>
                  <input type="number" className="form-control" value={form.min_stock_level} onChange={e => set('min_stock_level', e.target.value)} min="0" />
                </div>
                {!isEdit && !form.has_variants && (
                  <div className="form-group">
                    <label className="form-label">Opening Stock</label>
                    <input type="number" className="form-control" value={form.opening_stock} onChange={e => set('opening_stock', e.target.value)} min="0" />
                  </div>
                )}
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="hasVariants" checked={form.has_variants} onChange={e => set('has_variants', e.target.checked)} style={{ width: 16, height: 16 }} />
                  <label htmlFor="hasVariants" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>This product has size/color variants</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Variants */}
        {form.has_variants && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">Size & Color Variants</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={addVariant}>+ Add Variant</button>
            </div>
            <div className="card-body">
              {variants.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Add Variant" to define size/color combinations</p>
                : <table className="table">
                  <thead><tr><th>Size</th><th>Color</th><th>Purchase Price</th><th>Selling Price</th>{!isEdit && <th>Opening Stock</th>}<th></th></tr></thead>
                  <tbody>{variants.map((v, i) => (
                    <tr key={i}>
                      <td><select className="form-control" value={v.size_id} onChange={e => setVariantField(i, 'size_id', e.target.value)} style={{ padding: '6px 10px' }}>
                        <option value="">Size</option>{sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select></td>
                      <td><select className="form-control" value={v.color_id} onChange={e => setVariantField(i, 'color_id', e.target.value)} style={{ padding: '6px 10px' }}>
                        <option value="">Color</option>{colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select></td>
                      <td><input type="number" className="form-control" value={v.purchase_price} onChange={e => setVariantField(i, 'purchase_price', e.target.value)} style={{ padding: '6px 10px' }} /></td>
                      <td><input type="number" className="form-control" value={v.selling_price} onChange={e => setVariantField(i, 'selling_price', e.target.value)} style={{ padding: '6px 10px' }} /></td>
                      {!isEdit && <td><input type="number" className="form-control" value={v.opening_stock} onChange={e => setVariantField(i, 'opening_stock', e.target.value)} style={{ padding: '6px 10px' }} /></td>}
                      <td><button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeVariant(i)}>✕</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              }
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/products')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Saving...' : isEdit ? '✅ Update Product' : '✅ Add Product'}
          </button>
        </div>
      </form>
    </div>
  )
}
