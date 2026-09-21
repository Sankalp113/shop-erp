import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getDocuments, createDocument, deleteDocument } from '../services/db'
import { useAuth } from '../context/AuthContext'

const DOC_TYPES = ['invoice','purchase_order','contract','license','certificate','receipt','note','other']
const TYPE_ICONS = { invoice:'🧾', purchase_order:'📋', contract:'📝', license:'🏅', certificate:'🎖', receipt:'🗒', note:'📌', other:'📎' }

export default function Documents() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editDoc, setEditDoc] = useState(null)
  const [form, setForm] = useState({ title: '', document_type: 'note', tags: '', reference_number: '', reference_date: '', amount: '', party_name: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [search, docType])

  async function load() {
    setLoading(true)
    const r = await getDocuments({ document_type: docType, search })
    setDocs(r.data); setLoading(false)
  }

  function openAdd() {
    setEditDoc(null)
    setForm({ title: '', document_type: 'note', tags: '', reference_number: '', reference_date: new Date().toISOString().split('T')[0], amount: '', party_name: '', notes: '' })
    setShowForm(true)
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.title) return toast.error('Title is required')
    setSaving(true)
    try {
      await createDocument({ ...form, amount: form.amount ? Number(form.amount) : null }, user?.uid)
      toast.success('Record saved')
      setShowForm(false); load()
    } catch (err) { toast.error(err.message || 'Failed') } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('Delete this record?')) return
    await deleteDocument(id); toast.success('Deleted'); load()
  }

  const fmt = n => n ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>📁 Records & Documents</h1><p>Store important business notes, references, and records</p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Record</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-control" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="form-control" value={docType} onChange={e => setDocType(e.target.value)} style={{ width: 180 }}>
          <option value="">All Types</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
      </div>

      {/* Type quick filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${!docType ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDocType('')}>All</button>
        {DOC_TYPES.map(t => (
          <button key={t} className={`btn btn-sm ${docType === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDocType(t === docType ? '' : t)}>
            {TYPE_ICONS[t]} {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
        : docs.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">📁</div><h3>No records yet</h3><p>Add invoices, notes, contracts and other business records</p><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>➕ Add First Record</button></div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {docs.map(d => (
                <div key={d.id} className="card" style={{ transition: 'all 0.2s', border: '1px solid var(--border)' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 28 }}>{TYPE_ICONS[d.document_type] || '📎'}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{d.title}</div>
                          <span className="badge badge-info" style={{ marginTop: 4 }}>{d.document_type?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-danger btn-icon" onClick={() => del(d.id)}>🗑</button>
                    </div>

                    {(d.party_name || d.reference_number) && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {d.party_name && <span>👤 {d.party_name}</span>}
                        {d.reference_number && <span style={{ marginLeft: 10 }}>🔖 {d.reference_number}</span>}
                      </div>
                    )}
                    {d.reference_date && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>📅 {d.reference_date}</div>}
                    {d.amount > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-light)', marginBottom: 6 }}>{fmt(d.amount)}</div>}
                    {d.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>{d.notes}</div>}
                    {d.tags && <div style={{ fontSize: 11, color: 'var(--accent)' }}>{d.tags.split(',').map(t => `#${t.trim()}`).join(' ')}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{d.created_at?.split('T')[0]}</div>
                  </div>
                </div>
              ))}
            </div>
      }

      {/* Add Record Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📁 {editDoc ? 'Edit' : 'Add'} Record</span>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Title *</label>
                    <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. GST Invoice from Vendor XYZ" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-control" value={form.document_type} onChange={e => set('document_type', e.target.value)}>
                      {DOC_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference Number</label>
                    <input className="form-control" value={form.reference_number} onChange={e => set('reference_number', e.target.value)} placeholder="Invoice no, Contract no..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-control" value={form.reference_date} onChange={e => set('reference_date', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Party / Vendor / Customer</label>
                    <input className="form-control" value={form.party_name} onChange={e => set('party_name', e.target.value)} placeholder="Name of party involved" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₹)</label>
                    <input type="number" className="form-control" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" step="0.01" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Tags (comma-separated)</label>
                    <input className="form-control" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="invoice, gst, supplier" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Notes / Details</label>
                    <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional details, description..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '⏳ Saving...' : '✅ Save Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
