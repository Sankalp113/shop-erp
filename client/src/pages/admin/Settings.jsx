import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getSettings, updateSettings } from '../../services/db'

const SETTING_GROUPS = [
  { label:'🏪 Shop Information', keys: ['shop_name','shop_address','shop_city','shop_mobile','shop_email','shop_gstin'] },
  { label:'🧾 Billing', keys: ['invoice_prefix','next_invoice_number','currency_symbol','show_tax_on_bill','show_discount_on_bill'] },
  { label:'📦 Inventory', keys: ['low_stock_default_min','enable_negative_stock','auto_generate_product_code'] },
  { label:'💰 Finance', keys: ['financial_year_start','cash_opening_balance','enable_bank_reconciliation'] },
  { label:'⚙️ System', keys: ['date_format','timezone','backup_enabled'] },
]

const PLACEHOLDERS = {
  shop_name:'My Cloth Shop', shop_address:'123, Main Street', shop_city:'Mumbai', shop_mobile:'9999999999',
  shop_email:'shop@example.com', shop_gstin:'22AAAAA0000A1Z5', invoice_prefix:'INV', next_invoice_number:'1',
  currency_symbol:'₹', low_stock_default_min:'5', date_format:'DD/MM/YYYY', timezone:'Asia/Kolkata', cash_opening_balance:'0',
}

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings).finally(()=>setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try { await updateSettings(settings); toast.success('✅ Settings saved') }
    catch (err) { toast.error(err.message || 'Failed to save') } finally { setSaving(false) }
  }

  const BOOL_KEYS = ['show_tax_on_bill','show_discount_on_bill','enable_negative_stock','auto_generate_product_code','enable_bank_reconciliation','backup_enabled']
  const isBoolean = key => BOOL_KEYS.includes(key)
  const format = key => key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())

  if (loading) return <div className="loading-overlay"><span className="loading-spinner"/></div>

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>⚙️ Settings</h1><p>Configure your Cloth Shop ERP system</p></div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'⏳ Saving...':'💾 Save All Settings'}</button>
      </div>

      <div style={{display:'grid',gap:16}}>
        {SETTING_GROUPS.map(group=>(
          <div key={group.label} className="card">
            <div className="card-header" style={{marginBottom:16}}><span className="card-title">{group.label}</span></div>
            <div className="card-body" style={{paddingTop:0}}>
              <div className="form-row">
                {group.keys.map(key=>(
                  <div key={key} className="form-group">
                    <label className="form-label">{format(key)}</label>
                    {isBoolean(key)
                      ? <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0'}}>
                          <div style={{position:'relative',width:44,height:24,cursor:'pointer'}} onClick={()=>setSettings(p=>({...p,[key]:p[key]==='1'?'0':'1'}))}>
                            <div style={{position:'absolute',inset:0,borderRadius:99,background:settings[key]==='1'?'var(--primary)':'var(--border)',transition:'background 0.2s'}}/>
                            <div style={{position:'absolute',top:2,left:settings[key]==='1'?22:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
                          </div>
                          <span style={{fontSize:13,color:'var(--text-secondary)'}}>{settings[key]==='1'?'Enabled':'Disabled'}</span>
                        </div>
                      : <input className="form-control" value={settings[key]||''} placeholder={PLACEHOLDERS[key]||''} onChange={e=>setSettings(p=>({...p,[key]:e.target.value}))}/>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:16,padding:16,background:'rgba(124,58,237,0.06)',border:'1px solid rgba(124,58,237,0.2)',borderRadius:12,fontSize:13,color:'var(--text-muted)'}}>
        <strong style={{color:'var(--primary-light)'}}>💡 Tip:</strong> Settings are saved immediately to the database and take effect on the next page load.
        <br/>Default admin credentials: <strong style={{color:'var(--accent)'}}>admin / admin123</strong> — change this immediately!
      </div>
    </div>
  )
}
