'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Users2, Shield } from 'lucide-react'
import type { UserProfile, UserRole } from '@/types'
import { auth } from '@/lib/firebase/config'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'owner',       label: 'Owner',       desc: 'Full access to everything' },
  { value: 'admin',       label: 'Admin',        desc: 'Full access except destructive deletes' },
  { value: 'manager',     label: 'Manager',      desc: 'Sales, stock, purchases, staff' },
  { value: 'billing',     label: 'Billing',      desc: 'POS billing and customers only' },
  { value: 'inventory',   label: 'Inventory',    desc: 'Products and stock management' },
  { value: 'accountant',  label: 'Accountant',   desc: 'Finance, expenses, salaries' },
]

const ROLE_COLORS: Record<string,string> = {
  owner: 'badge-danger', admin: 'badge-primary', manager: 'badge-warning',
  billing: 'badge-info', inventory: 'badge-success', accountant: 'badge-muted',
}

export default function AdminUsersPage() {
  const { isOwnerOrAdmin, profile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', mobile:'', role:'billing' as UserRole })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db,'users'), orderBy('name')))
      setUsers(snap.docs.map(d=>({uid:d.id,...d.data()}) as UserProfile))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(()=>{load()},[load])
  const set = (k:string,v:any)=>setForm(p=>({...p,[k]:v}))

  async function createUser(e:React.FormEvent) {
    e.preventDefault()
    if(!form.name||!form.email) return toast.error('Name and email required')
    setCreating(true)
    try {
      // Create auth user with temp password
      const tempPass = `Shop@${Math.random().toString(36).slice(-6)}`
      const cred = await createUserWithEmailAndPassword(auth, form.email, tempPass)
      // Save user profile in Firestore
      await addDoc(collection(db,'users'), {
        uid: cred.user.uid, name: form.name, email: form.email,
        mobile: form.mobile||null, role: form.role, status: 'active',
        createdAt: serverTimestamp(),
      })
      // Send password reset so user sets their own password
      await sendPasswordResetEmail(auth, form.email)
      toast.success(`User created! Password reset email sent to ${form.email}`)
      setShowForm(false)
      setForm({ name:'',email:'',mobile:'',role:'billing' })
      load()
    } catch(err:any) {
      toast.error(err.code==='auth/email-already-in-use'?'Email already exists':err.message)
    }
    setCreating(false)
  }

  async function toggleStatus(u: UserProfile) {
    if(u.uid===profile?.uid) return toast.error('Cannot deactivate your own account')
    const newStatus = u.status==='active'?'inactive':'active'
    try {
      await updateDoc(doc(db,'users',u.uid),{status:newStatus,updatedAt:serverTimestamp()})
      toast.success(`User ${newStatus}`)
      load()
    } catch {}
  }

  async function updateRole(u: UserProfile, role: UserRole) {
    if(u.uid===profile?.uid) return toast.error('Cannot change your own role')
    try {
      await updateDoc(doc(db,'users',u.uid),{role,updatedAt:serverTimestamp()})
      toast.success('Role updated')
      load()
    } catch {}
  }

  if(!isOwnerOrAdmin) return <div className="empty-state pt-20"><Shield size={48} className="opacity-20 mb-4"/><p>Access denied — Owner/Admin only</p></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Users & Roles</h1><p className="page-subtitle">{users.filter(u=>u.status==='active').length} active users</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={16}/> Add User</button>
      </div>

      {/* Role Reference */}
      <div className="glass-card p-4 mb-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Role Permissions Reference</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ROLES.map(r=>(
            <div key={r.value} className="flex items-start gap-2 p-2">
              <span className={`badge ${ROLE_COLORS[r.value]} mt-0.5`}>{r.label}</span>
              <span className="text-xs text-gray-500">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>User</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading?<tr><td colSpan={6} className="text-center py-10"><div className="spinner mx-auto"/></td></tr>
              :users.length===0?<tr><td colSpan={6}><div className="empty-state"><Users2 size={40} className="opacity-30 mb-3"/><p>No users found</p></div></td></tr>
              :users.map(u=>(
                <tr key={u.uid}>
                  <td><div className="font-semibold text-gray-200">{u.name}</div></td>
                  <td className="text-gray-400">{u.email}</td>
                  <td>{u.mobile||'—'}</td>
                  <td>
                    {u.uid===profile?.uid
                      ? <span className={`badge ${ROLE_COLORS[u.role]||'badge-muted'} capitalize`}>{u.role}</span>
                      : <select className="form-select w-auto text-xs py-1" value={u.role} onChange={e=>updateRole(u,e.target.value as UserRole)}>
                          {ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    }
                  </td>
                  <td><span className={`badge ${u.status==='active'?'badge-success':'badge-muted'}`}>{u.status}</span></td>
                  <td>
                    {u.uid!==profile?.uid&&(
                      <button className={`btn btn-sm ${u.status==='active'?'btn-secondary':'btn-success'}`} onClick={()=>toggleStatus(u)}>
                        {u.status==='active'?'Deactivate':'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div className="modal modal-md">
            <div className="modal-header"><h3 className="modal-title">Add User</h3><button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
            <form onSubmit={createUser}>
              <div className="modal-body space-y-4">
                <div className="form-row">
                  <div><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required/></div>
                  <div><label className="form-label">Mobile</label><input className="form-input" value={form.mobile} onChange={e=>set('mobile',e.target.value)}/></div>
                </div>
                <div><label className="form-label">Email Address *</label><input type="email" className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} required/><p className="text-xs text-gray-600 mt-1">A password reset link will be sent to this email</p></div>
                <div><label className="form-label">Role *</label>
                  <select className="form-select" value={form.role} onChange={e=>set('role',e.target.value)}>
                    {ROLES.map(r=><option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating?'Creating…':'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
