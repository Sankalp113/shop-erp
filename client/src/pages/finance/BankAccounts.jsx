import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const fmt = n => `₹${Number(n||0).toLocaleString('en-IN')}`

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txnFrom, setTxnFrom] = useState(new Date(Date.now()-30*86400000).toISOString().split('T')[0])
  const [txnTo, setTxnTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [txnLoading, setTxnLoading] = useState(false)
  const [showAccForm, setShowAccForm] = useState(false)
  const [showTxnForm, setShowTxnForm] = useState(false)
  const [accForm, setAccForm] = useState({ account_name:'', bank_name:'', account_number:'', ifsc_code:'', opening_balance:0 })
  const [txnForm, setTxnForm] = useState({ transaction_date: new Date().toISOString().split('T')[0], transaction_type:'deposit', description:'', amount:'', reference_number:'' })

  useEffect(() => { loadAccounts() }, [])
  useEffect(() => { if(selected) loadTxns() }, [selected, txnFrom, txnTo])

  async function loadAccounts() { const r = await api.get('/finance/bank/accounts'); setAccounts(r.data); if(r.data.length>0&&!selected) setSelected(r.data[0].id); setLoading(false) }
  async function loadTxns() { setTxnLoading(true); const r = await api.get(`/finance/bank/${selected}/transactions`, { params:{from:txnFrom,to:txnTo,limit:200} }); setTransactions(r.data.data); setTxnLoading(false) }

  async function addAccount(e) {
    e.preventDefault()
    try { await api.post('/finance/bank/accounts', accForm); toast.success('Account added'); setShowAccForm(false); loadAccounts() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  async function addTxn(e) {
    e.preventDefault()
    const amt = txnForm.transaction_type==='withdrawal'||txnForm.transaction_type==='payment' ? -Math.abs(Number(txnForm.amount)) : Math.abs(Number(txnForm.amount))
    try { await api.post(`/finance/bank/${selected}/transactions`, { ...txnForm, amount: amt }); toast.success('Transaction added'); setShowTxnForm(false); loadTxns() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const selectedAccount = accounts.find(a=>a.id===selected)

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h1>🏧 Bank Accounts</h1><p>Manage bank balances and transactions</p></div>
        <button className="btn btn-secondary" onClick={()=>setShowAccForm(true)}>➕ Add Account</button>
      </div>

      {/* Account Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16,marginBottom:24}}>
        {accounts.map(acc=>(
          <div key={acc.id} className="card" style={{cursor:'pointer',border:selected===acc.id?'1px solid var(--primary)':'1px solid var(--border)',background:selected===acc.id?'rgba(124,58,237,0.08)':'var(--bg-card)'}} onClick={()=>setSelected(acc.id)}>
            <div className="card-body">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div style={{fontSize:24}}>🏦</div>
                {selected===acc.id && <span className="badge badge-primary">Selected</span>}
              </div>
              <div style={{fontWeight:700,marginBottom:4}}>{acc.account_name}</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>{acc.bank_name}{acc.account_number?` · ****${acc.account_number.slice(-4)}`:''}</div>
              <div style={{fontSize:22,fontWeight:800,color:'var(--success)'}}>{fmt(acc.current_balance)}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Current Balance</div>
            </div>
          </div>
        ))}
        {accounts.length===0 && !loading && (
          <div className="empty-state"><div className="empty-state-icon">🏦</div><h3>No bank accounts</h3><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setShowAccForm(true)}>Add First Account</button></div>
        )}
      </div>

      {selected && selectedAccount && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{fontWeight:600,fontSize:15}}>📒 {selectedAccount.account_name} — Transactions</div>
            <div style={{display:'flex',gap:8}}>
              <input type="date" className="form-control" style={{width:'auto'}} value={txnFrom} onChange={e=>setTxnFrom(e.target.value)}/>
              <input type="date" className="form-control" style={{width:'auto'}} value={txnTo} onChange={e=>setTxnTo(e.target.value)}/>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowTxnForm(true)}>➕ Add</button>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{padding:0}}>
              {txnLoading ? <div className="loading-overlay"><span className="loading-spinner"/></div>
                : transactions.length===0
                  ? <div className="empty-state"><div className="empty-state-icon">🏦</div><h3>No transactions in this period</h3></div>
                  : <div className="table-container"><table className="table">
                    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th style={{textAlign:'right'}}>Credit</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Balance</th></tr></thead>
                    <tbody>{transactions.map(t=>(
                      <tr key={t.id}>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{t.transaction_date}</td>
                        <td style={{fontSize:11,textTransform:'uppercase',color:'var(--text-muted)'}}>{t.transaction_type}</td>
                        <td style={{fontWeight:500}}>{t.description}</td>
                        <td style={{fontSize:11,color:'var(--text-muted)'}}>{t.reference_number||'—'}</td>
                        <td style={{textAlign:'right',color:'var(--success)',fontWeight:t.amount>0?700:400}}>{t.amount>0?fmt(t.amount):'—'}</td>
                        <td style={{textAlign:'right',color:'var(--danger)',fontWeight:t.amount<0?700:400}}>{t.amount<0?fmt(Math.abs(t.amount)):'—'}</td>
                        <td style={{textAlign:'right',fontWeight:700}}>{fmt(t.balance_after)}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
              }
            </div>
          </div>
        </>
      )}

      {/* Add Account Modal */}
      {showAccForm && (
        <div className="modal-overlay" onClick={()=>setShowAccForm(false)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🏦 Add Bank Account</span><button className="modal-close" onClick={()=>setShowAccForm(false)}>✕</button></div>
            <form onSubmit={addAccount}>
              <div className="modal-body">
                {[['account_name','Account Name *'],['bank_name','Bank Name'],['account_number','Account Number'],['ifsc_code','IFSC Code']].map(([k,l])=>(
                  <div key={k} className="form-group"><label className="form-label">{l}</label><input className="form-control" value={accForm[k]||''} onChange={e=>setAccForm(p=>({...p,[k]:e.target.value}))} required={k==='account_name'}/></div>
                ))}
                <div className="form-group"><label className="form-label">Opening Balance</label><input type="number" className="form-control" value={accForm.opening_balance} onChange={e=>setAccForm(p=>({...p,opening_balance:e.target.value}))}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowAccForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Add Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showTxnForm && (
        <div className="modal-overlay" onClick={()=>setShowTxnForm(false)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💳 Add Transaction</span><button className="modal-close" onClick={()=>setShowTxnForm(false)}>✕</button></div>
            <form onSubmit={addTxn}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-control" value={txnForm.transaction_date} onChange={e=>setTxnForm(p=>({...p,transaction_date:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Type</label>
                  <select className="form-control" value={txnForm.transaction_type} onChange={e=>setTxnForm(p=>({...p,transaction_type:e.target.value}))}>
                    <option value="deposit">Deposit (In)</option><option value="withdrawal">Withdrawal (Out)</option><option value="transfer">Transfer</option><option value="payment">Payment</option><option value="receipt">Receipt</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Description *</label><input className="form-control" value={txnForm.description} onChange={e=>setTxnForm(p=>({...p,description:e.target.value}))} required/></div>
                <div className="form-group"><label className="form-label">Amount *</label><input type="number" className="form-control" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))} required/></div>
                <div className="form-group"><label className="form-label">Reference / Cheque No.</label><input className="form-control" value={txnForm.reference_number} onChange={e=>setTxnForm(p=>({...p,reference_number:e.target.value}))}/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowTxnForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">✅ Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
