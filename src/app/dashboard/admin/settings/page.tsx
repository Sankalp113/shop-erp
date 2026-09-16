'use client'
import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Settings } from 'lucide-react'

const DEFAULTS = {
  shopName: 'My Cloth Shop', shopAddress: '', shopCity: '', shopMobile: '', shopEmail: '',
  shopGstin: '', invoicePrefix: 'INV', currencySymbol: '₹',
  financialYearStart: '04', lowStockDefaultMin: '5', enableNegativeStock: 'false',
}

export default function SettingsPage() {
  const { isOwnerOrAdmin } = useAuth()
  const [settings, setSettings] = useState<Record<string,string>>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'shop'|'invoice'|'stock'>('shop')

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db,'settings','app'))
        if (snap.exists()) setSettings(s => ({ ...s, ...snap.data() as any }))
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const set = (k: string, v: string) => setSettings(p => ({ ...p, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db,'settings','app'), { ...settings, updatedAt: serverTimestamp() }, { merge: true })
      toast.success('Settings saved')
    } catch (err: any) { toast.error(err.message) }
    setSaving(false)
  }

  if (!isOwnerOrAdmin) return <div className="empty-state pt-20"><Settings size={48} className="opacity-20 mb-4"/><p>Access denied — Owner/Admin only</p></div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure your shop preferences</p></div>
        <button className="btn btn-primary" onClick={save} disabled={saving || loading}>{saving?'Saving…':'💾 Save'}</button>
      </div>

      <div className="tabs mb-5">
        <button className={`tab ${tab==='shop'?'active':''}`} onClick={()=>setTab('shop')}>Shop Info</button>
        <button className={`tab ${tab==='invoice'?'active':''}`} onClick={()=>setTab('invoice')}>Invoice</button>
        <button className={`tab ${tab==='stock'?'active':''}`} onClick={()=>setTab('stock')}>Stock</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner"/></div> : (
        <div className="glass-card p-6 space-y-4">
          {tab === 'shop' && <>
            <div><label className="form-label">Shop Name</label><input className="form-input" value={settings.shopName} onChange={e=>set('shopName',e.target.value)}/></div>
            <div><label className="form-label">Address</label><input className="form-input" value={settings.shopAddress} onChange={e=>set('shopAddress',e.target.value)}/></div>
            <div className="form-row">
              <div><label className="form-label">City</label><input className="form-input" value={settings.shopCity} onChange={e=>set('shopCity',e.target.value)}/></div>
              <div><label className="form-label">Mobile</label><input className="form-input" value={settings.shopMobile} onChange={e=>set('shopMobile',e.target.value)}/></div>
            </div>
            <div className="form-row">
              <div><label className="form-label">Email</label><input type="email" className="form-input" value={settings.shopEmail} onChange={e=>set('shopEmail',e.target.value)}/></div>
              <div><label className="form-label">GSTIN</label><input className="form-input" value={settings.shopGstin} onChange={e=>set('shopGstin',e.target.value.toUpperCase())} maxLength={15}/></div>
            </div>
          </>}

          {tab === 'invoice' && <>
            <div className="form-row">
              <div><label className="form-label">Invoice Prefix</label><input className="form-input" value={settings.invoicePrefix} onChange={e=>set('invoicePrefix',e.target.value)} placeholder="INV"/></div>
              <div><label className="form-label">Currency Symbol</label><input className="form-input" value={settings.currencySymbol} onChange={e=>set('currencySymbol',e.target.value)}/></div>
            </div>
            <div><label className="form-label">Financial Year Start Month</label>
              <select className="form-select" value={settings.financialYearStart} onChange={e=>set('financialYearStart',e.target.value)}>
                <option value="04">April (Apr–Mar)</option>
                <option value="01">January (Jan–Dec)</option>
              </select>
            </div>
          </>}

          {tab === 'stock' && <>
            <div><label className="form-label">Default Minimum Stock Level</label><input type="number" className="form-input" value={settings.lowStockDefaultMin} onChange={e=>set('lowStockDefaultMin',e.target.value)} min="0"/></div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-violet-500" checked={settings.enableNegativeStock==='true'} onChange={e=>set('enableNegativeStock',String(e.target.checked))}/>
              <div>
                <div className="text-sm font-medium text-gray-200">Allow Negative Stock</div>
                <div className="text-xs text-gray-500">Allow sales even when stock is zero (not recommended)</div>
              </div>
            </label>
          </>}
        </div>
      )}
    </div>
  )
}
