import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username:'', password:'', full_name:'', email:'', mobile:'', role_name:'staff', is_active:1 })

  useEffect(() => { load(); api.get('/users/roles').then(r=>setRoles(r.data)) }, [])
  async function load() { const r = await api.get('/users'); setUsers(r.data); setLoading(false) }

  function openAdd() { setEditUser(null); setForm({ username:'', password:'', full_name:'', email:'', mobile:'', role_name:'staff', is_active:1 }); setShowForm(true) }
  function openEdit(u) { setEditUser(u); setForm({ ...u, password:'', role_name: u.role_name }); setShowForm(true) }

  async function submit(e) {
    e.preventDefault()
    try {
      if (editUser) { await api.put(`/users/${editUser.id}`, form); toast.success('User updated') }
      else { await api.post('/users', form); toast.success('User created') }
      setShowForm(false); load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const ROLE_COLORS = { owner:'badge-danger', manager:'badge-warning', staff:'badge-info', accountant:'badge-primary' }

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>👤 Users & Roles</h1><p>Manage staff access and permissions</p></div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add User</button>
      </div>

      <div className="card">
        <div className="card-body" style={{padding:0}}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
            : <div className="table-container"><table className="table">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Mobile</th><th>Last Login</th><th>Status</th><th></th></tr></thead>
              <tbody>{users.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:600}}>{u.full_name}</td>
                  <td style={{fontFamily:'monospace',fontSize:13,color:'var(--accent)'}}>{u.username}</td>
                  <td><span className={`badge ${ROLE_COLORS[u.role_name]||'badge-muted'}`}>{u.role_name}</span></td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{u.mobile||'—'}</td>
                  <td style={{fontSize:12,color:'var(--text-muted)'}}>{u.last_login?u.last_login.split('T')[0]:'Never'}</td>
                  <td><span className={`badge ${u.is_active?'badge-success':'badge-muted'}`}>{u.is_active?'Active':'Inactive'}</span></td>
                  <td><button className="btn btn-sm btn-secondary" onClick={()=>openEdit(u)}>✏️</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          }
        </div>
      </div>

      {/* Role info */}
      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><span className="card-title">🔐 Role Permissions</span></div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {[
              { role:'Owner', color:'var(--danger)', perms:['Full access to all modules','User management','Reports & settings','Delete records'] },
              { role:'Manager', color:'var(--warning)', perms:['Sales, Purchase, Inventory','Customer & vendor management','Reports (no settings)','No user management'] },
              { role:'Staff', color:'var(--info)', perms:['New sales (POS)','View products & stock','Basic reports','No financial data'] },
              { role:'Accountant', color:'var(--primary-light)', perms:['Finance & accounts','Expenses & salaries','Reports & reconciliation','No inventory changes'] },
            ].map(r=>(
              <div key={r.role} style={{background:'var(--bg-input)',borderRadius:10,padding:12,border:`1px solid ${r.color}44`}}>
                <div style={{fontWeight:700,color:r.color,marginBottom:8,fontSize:13}}>{r.role}</div>
                {r.perms.map(p=><div key={p} style={{fontSize:11,color:'var(--text-muted)',marginBottom:3}}>✓ {p}</div>)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editUser?'✏️ Edit':'➕ Add'} User</span><button className="modal-close" onClick={()=>setShowForm(false)}>✕</button></div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Full Name *</label><input className="form-control" value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} required/></div>
                  <div className="form-group"><label className="form-label">Username *</label><input className="form-control" value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} disabled={!!editUser} required/></div>
                  <div className="form-group"><label className="form-label">{editUser?'New Password (leave blank to keep)':'Password *'}</label><input type="password" className="form-control" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} required={!editUser}/></div>
                  <div className="form-group"><label className="form-label">Role</label>
                    <select className="form-control" value={form.role_name} onChange={e=>setForm(p=>({...p,role_name:e.target.value}))}>
                      {roles.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Mobile</label><input className="form-control" value={form.mobile||''} onChange={e=>setForm(p=>({...p,mobile:e.target.value}))}/></div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email||''} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
                  {editUser && <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" id="isActive" checked={form.is_active} onChange={e=>setForm(p=>({...p,is_active:e.target.checked?1:0}))}/><label htmlFor="isActive" style={{cursor:'pointer',fontSize:13}}>Active</label>
                  </div>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ {editUser?'Update':'Create'} User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
