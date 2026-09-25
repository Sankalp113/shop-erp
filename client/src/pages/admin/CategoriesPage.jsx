import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCategoriesTree, createCategory, updateCategory, deleteCategory } from '../../services/db'

const BLANK = { name: '', description: '' }

export default function CategoriesPage() {
  const [tree, setTree] = useState({ parents: [], children: {}, all: [] })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [parentId, setParentId] = useState(null) // null = main category
  const [form, setForm] = useState(BLANK)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const t = await getCategoriesTree()
    setTree(t); setLoading(false)
  }

  function openAddMain() { setEditItem(null); setParentId(null); setForm(BLANK); setShowForm(true) }
  function openAddSub(pid) { setEditItem(null); setParentId(pid); setForm(BLANK); setShowForm(true) }
  function openEdit(cat) { setEditItem(cat); setParentId(cat.parent_id || null); setForm({ name: cat.name, description: cat.description || '' }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditItem(null); setParentId(null); setForm(BLANK) }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Category name required')
    try {
      if (editItem) {
        await updateCategory(editItem.id, form)
        toast.success('Category updated')
      } else {
        await createCategory({ ...form, parent_id: parentId })
        toast.success(parentId ? 'Sub-category added' : 'Main category added')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDelete(cat) {
    const hasChildren = (tree.children[cat.id] || []).length > 0
    const msg = hasChildren
      ? `Delete "${cat.name}" and all its ${tree.children[cat.id].length} sub-categories? Products in these categories will lose their category.`
      : `Delete category "${cat.name}"? Products in this category will lose their category.`
    if (!window.confirm(msg)) return
    try {
      await deleteCategory(cat.id)
      toast.success(`"${cat.name}" deleted`)
      load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  const filteredParents = search
    ? tree.parents.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (tree.children[p.id] || []).some(c => c.name.toLowerCase().includes(search.toLowerCase()))
      )
    : tree.parents

  const totalCategories = tree.all.length
  const totalParents = tree.parents.length
  const totalChildren = tree.all.filter(c => c.parent_id).length

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🗂️ Category Management</h1>
          <p>{totalParents} main categories · {totalChildren} sub-categories · {totalCategories} total</p>
        </div>
        <button className="btn btn-primary" onClick={openAddMain}>➕ Add Main Category</button>
      </div>

      <input
        className="form-control"
        placeholder="🔍 Search categories..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <div className="loading-overlay"><span className="loading-spinner" /></div>
      ) : filteredParents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <h3>{search ? 'No matching categories' : 'No categories yet'}</h3>
          {!search && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAddMain}>Add First Category</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredParents.map(parent => {
            const subs = tree.children[parent.id] || []
            const filteredSubs = search
              ? subs.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
              : subs
            return (
              <div key={parent.id} className="card">
                {/* Parent category header */}
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: subs.length > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 18 }}>📁</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{parent.name}</div>
                    {parent.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{parent.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {subs.length > 0 ? `${subs.length} sub-categor${subs.length === 1 ? 'y' : 'ies'}` : 'No sub-categories'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openAddSub(parent.id)}>➕ Add Sub</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(parent)}>✏️</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => handleDelete(parent)}>🗑️</button>
                  </div>
                </div>

                {/* Sub-categories */}
                {filteredSubs.length > 0 && (
                  <div style={{ padding: '8px 20px 12px 44px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {filteredSubs.map(sub => (
                      <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13 }}>
                        <span style={{ fontSize: 12 }}>└</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{sub.name}</span>
                        {sub.description && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {sub.description}</span>}
                        <button
                          onClick={() => openEdit(sub)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px', color: 'var(--text-muted)', lineHeight: 1 }}
                          title="Edit"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(sub)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px', color: '#ef4444', lineHeight: 1 }}
                          title="Delete"
                        >✕</button>
                      </div>
                    ))}
                    <button
                      className="btn btn-sm"
                      style={{ borderRadius: 20, border: '1px dashed var(--border)', fontSize: 12, padding: '4px 12px', color: 'var(--text-muted)', background: 'none' }}
                      onClick={() => openAddSub(parent.id)}
                    >+ Add Sub-category</button>
                  </div>
                )}
                {filteredSubs.length === 0 && subs.length === 0 && (
                  <div style={{ padding: '8px 20px 12px 44px' }}>
                    <button
                      className="btn btn-sm"
                      style={{ borderRadius: 20, border: '1px dashed var(--border)', fontSize: 12, padding: '4px 12px', color: 'var(--text-muted)', background: 'none' }}
                      onClick={() => openAddSub(parent.id)}
                    >+ Add Sub-category</button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Orphan sub-categories (if their parent was deleted) */}
          {(() => {
            const orphans = tree.all.filter(c => c.parent_id && !tree.parents.find(p => p.id === c.parent_id))
            if (orphans.length === 0) return null
            return (
              <div className="card" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>⚠️ Uncategorized Sub-categories</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>These sub-categories have no parent</span>
                </div>
                <div style={{ padding: '8px 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {orphans.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13 }}>
                      <span>{c.name}</span>
                      <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✏️</button>
                      <button onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {editItem ? '✏️ Edit Category' : parentId ? '📂 Add Sub-category' : '📁 Add Main Category'}
              </span>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {parentId && !editItem && (
                  <div style={{ padding: '8px 12px', background: 'rgba(124,58,237,0.08)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                    📁 Under: <strong>{tree.parents.find(p => p.id === parentId)?.name}</strong>
                  </div>
                )}
                {editItem?.parent_id && editItem && (
                  <div style={{ padding: '8px 12px', background: 'rgba(124,58,237,0.08)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                    📁 Parent: <strong>{tree.parents.find(p => p.id === editItem.parent_id)?.name}</strong>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={parentId ? 'e.g. Casual Shirts, Formal Trousers' : 'e.g. Men\'s Wear, Women\'s Wear'}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <input
                    className="form-control"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Short description..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editItem ? '💾 Update' : '✅ Add'} {editItem?.parent_id || parentId ? 'Sub-category' : 'Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
