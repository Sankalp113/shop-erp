import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [file, setFile] = useState(null)
  const [meta, setMeta] = useState({ title:'', document_type:'invoice', tags:'', notes:'' })

  const DOC_TYPES = ['invoice','purchase_order','contract','license','certificate','photo','receipt','other']

  useEffect(() => { load() }, [search, docType])

  async function load() {
    setLoading(true)
    const r = await api.get('/documents', { params: { search, document_type: docType } })
    setDocs(r.data); setLoading(false)
  }

  async function upload(e) {
    e.preventDefault()
    if (!file) return toast.error('Select a file')
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    Object.entries(meta).forEach(([k,v]) => fd.append(k, v))
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('File uploaded'); setShowForm(false); setFile(null); setMeta({ title:'', document_type:'invoice', tags:'', notes:'' }); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed') } finally { setUploading(false) }
  }

  async function deleteDoc(id) {
    if (!confirm('Delete this document?')) return
    await api.delete(`/documents/${id}`); toast.success('Deleted'); load()
  }

  const EXT_ICONS = { pdf:'📄', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', xlsx:'📊', xls:'📊', doc:'📝', docx:'📝', default:'📎' }
  const getIcon = name => { const ext = name?.split('.').pop()?.toLowerCase(); return EXT_ICONS[ext] || EXT_ICONS.default }
  const formatSize = b => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>📁 Documents</h1><p>Store invoices, licenses, contracts, and business files</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>📤 Upload Document</button>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:16}}>
        <input className="form-control" placeholder="🔍 Search documents..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}}/>
        <select className="form-control" value={docType} onChange={e=>setDocType(e.target.value)} style={{width:180}}>
          <option value="">All Types</option>
          {DOC_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
        : docs.length===0
          ? <div className="empty-state"><div className="empty-state-icon">📁</div><h3>No documents yet</h3><p>Upload invoices, contracts, and other business documents</p><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setShowForm(true)}>📤 Upload First Document</button></div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16}}>
            {docs.map(d=>(
              <div key={d.id} className="card" style={{transition:'all 0.2s'}}>
                <div className="card-body">
                  <div style={{fontSize:40,textAlign:'center',marginBottom:12}}>{getIcon(d.file_name)}</div>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={d.title}>{d.title||d.file_name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>
                    <span className="badge badge-muted" style={{marginRight:4}}>{d.document_type}</span>
                    {formatSize(d.file_size||0)}
                  </div>
                  {d.tags && <div style={{fontSize:11,color:'var(--accent)',marginBottom:8}}>{d.tags.split(',').map(t=>`#${t.trim()}`).join(' ')}</div>}
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>{d.created_at?.split('T')[0]} · {d.uploaded_by_name}</div>
                  <div style={{display:'flex',gap:6}}>
                    <a href={d.file_path} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" style={{flex:1,justifyContent:'center'}}>👁 View</a>
                    <button className="btn btn-sm btn-danger btn-icon" onClick={()=>deleteDoc(d.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">📤 Upload Document</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={upload}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">File *</label>
                  <div style={{border:'2px dashed var(--border)',borderRadius:12,padding:24,textAlign:'center',cursor:'pointer',transition:'all 0.2s'}}
                    onClick={()=>document.getElementById('fileInput').click()}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{e.preventDefault();setFile(e.dataTransfer.files[0])}}>
                    <input id="fileInput" type="file" style={{display:'none'}} onChange={e=>setFile(e.target.files[0])} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"/>
                    {file ? <><div style={{fontSize:32,marginBottom:8}}>{getIcon(file.name)}</div><div style={{fontWeight:600}}>{file.name}</div><div style={{fontSize:12,color:'var(--text-muted)'}}>{formatSize(file.size)}</div></>
                      : <><div style={{fontSize:32,marginBottom:8,opacity:0.4}}>📤</div><p style={{color:'var(--text-muted)',fontSize:13}}>Click or drag & drop a file here</p><p style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>PDF, Images, Excel, Word — max 10MB</p></>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Title</label><input className="form-control" value={meta.title} onChange={e=>setMeta(p=>({...p,title:e.target.value}))} placeholder="Document title"/></div>
                  <div className="form-group"><label className="form-label">Type</label>
                    <select className="form-control" value={meta.document_type} onChange={e=>setMeta(p=>({...p,document_type:e.target.value}))}>
                      {DOC_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                    </select></div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Tags (comma-separated)</label><input className="form-control" value={meta.tags} onChange={e=>setMeta(p=>({...p,tags:e.target.value}))} placeholder="invoice, supplier, 2026"/></div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Notes</label><textarea className="form-control" value={meta.notes} onChange={e=>setMeta(p=>({...p,notes:e.target.value}))} rows={2}/></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading?'⏳ Uploading...':'📤 Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
