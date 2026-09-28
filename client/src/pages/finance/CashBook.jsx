import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCashBook, getUpiBook, addCashTransaction, addUpiTransaction, deleteCashTransaction, updateCashTransaction } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from '../../context/AccountContext'

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const BLANK = { transaction_date: new Date().toISOString().split('T')[0], transaction_type: 'receipt', description: '', amount: '' }

const TYPE_COLORS = {
  sale: 'var(--success)', purchase: 'var(--danger)', expense: 'var(--danger)',
  salary: 'var(--danger)', receipt: 'var(--success)', payment: 'var(--danger)',
  vendor_payment: 'var(--danger)', customer_payment: 'var(--success)', other: 'var(--text-muted)'
}

export default function CashBook() {
  const { user } = useAuth()
  const { account } = useAccount()
  const [activeTab, setActiveTab] = useState('cash') // 'cash' | 'upi'
  const [cashTx, setCashTx] = useState([])
  const [upiTx, setUpiTx] = useState([])
  const [cashBal, setCashBal] = useState(0)
  const [upiBal, setUpiBal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { load() }, [from, to, account])

  async function load() {
    setLoading(true)
    const [cashRes, upiRes] = await Promise.all([
      getCashBook({ from, to, account: account === 'Combined' ? undefined : account }),
      getUpiBook({ from, to, account: account === 'Combined' ? undefined : account }),
    ])
    setCashTx(cashRes.data); setCashBal(cashRes.current_balance)
    setUpiTx(upiRes.data); setUpiBal(upiRes.current_balance)
    setLoading(false)
  }

  function openAdd() { setEditItem(null); setForm(BLANK); setShowForm(true) }
  function openEdit(t) {
    setEditItem(t)
    setForm({ transaction_date: t.transaction_date, transaction_type: t.transaction_type, description: t.description, amount: Math.abs(t.amount) })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditItem(null); setForm(BLANK) }

  async function submit(e) {
    e.preventDefault()
    const isOut = form.transaction_type === 'payment'
    try {
      if (editItem) {
        await updateCashTransaction(editItem.id, {
          transaction_date: form.transaction_date,
          transaction_type: form.transaction_type,
          description: form.description,
          amount: isOut ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount))
        })
        toast.success('Transaction updated')
      } else {
        const fn = activeTab === 'upi' ? addUpiTransaction : addCashTransaction
        await fn({ ...form, is_inflow: !isOut, amount: Number(form.amount), account: account === 'Combined' ? null : account }, user?.uid)
        toast.success('Transaction recorded')
      }
      closeForm(); load()
    } catch (err) { toast.error(err.message || 'Failed') }
  }

  async function handleDelete(t) {
    if (!window.confirm(`Delete this entry?\n"${t.description}" — ${fmt(Math.abs(t.amount))}`)) return
    try { await deleteCashTransaction(t.id); toast.success('Entry deleted'); load() }
    catch (err) { toast.error(err.message || 'Failed') }
  }

  const transactions = activeTab === 'cash' ? cashTx : upiTx
  const totalIn = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const isManual = t => ['receipt', 'payment', 'other'].includes(t.transaction_type)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>💰 Cash & UPI Book</h1>
          <p>Separate running balances for Cash and UPI payments</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* Balance chips */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ textAlign: 'right', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '8px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>💵 Cash Balance</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{fmt(cashBal)}</div>
            </div>
            <div style={{ textAlign: 'right', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '8px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📱 UPI Balance</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>{fmt(upiBal)}</div>
            </div>
            <div style={{ textAlign: 'right', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '8px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏦 Total Liquid</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>{fmt(cashBal + upiBal)}</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>➕ Add Entry</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {[
          { key: 'cash', label: '💵 Cash Book', bal: cashBal },
          { key: 'upi', label: '📱 UPI Book', bal: upiBal },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, fontWeight: 600,
              background: activeTab === tab.key ? (tab.key === 'upi' ? 'linear-gradient(135deg,#6366f1,#818cf8)' : 'linear-gradient(135deg,#10b981,#059669)') : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-muted)' }}>
            {tab.label}
            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.85 }}>{fmt(tab.bal)}</span>
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: activeTab === 'cash' ? 'Cash In' : 'UPI In', val: fmt(totalIn), color: 'var(--success)', icon: '📥' },
          { label: activeTab === 'cash' ? 'Cash Out' : 'UPI Out', val: fmt(totalOut), color: 'var(--danger)', icon: '📤' },
          { label: 'Net', val: fmt(totalIn - totalOut), color: totalIn >= totalOut ? 'var(--success)' : 'var(--danger)', icon: activeTab === 'cash' ? '💵' : '📱' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
        {account !== 'Combined' && (
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20,
            background: account === 'VR' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
            color: account === 'VR' ? '#818cf8' : 'var(--success)' }}>
            {account === 'VR' ? '🔵 VR' : '🟢 Janta'}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{transactions.length} entries</span>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading-overlay"><span className="loading-spinner" /></div>
            : transactions.length === 0
              ? <div className="empty-state">
                  <div className="empty-state-icon">{activeTab === 'cash' ? '💵' : '📱'}</div>
                  <h3>No {activeTab === 'cash' ? 'cash' : 'UPI'} transactions in this range</h3>
                </div>
              : <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        {account === 'Combined' && <th>Account</th>}
                        <th style={{ textAlign: 'right' }}>In</th>
                        <th style={{ textAlign: 'right' }}>Out</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.transaction_date}</td>
                          <td>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                              background: `${TYPE_COLORS[t.transaction_type] || 'var(--text-muted)'}22`,
                              color: TYPE_COLORS[t.transaction_type] || 'var(--text-muted)',
                              fontWeight: 600, textTransform: 'uppercase' }}>
                              {t.transaction_type?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{t.description}</td>
                          {account === 'Combined' && (
                            <td>
                              {t.account && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                                background: t.account === 'VR' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
                                color: t.account === 'VR' ? '#818cf8' : 'var(--success)' }}>
                                {t.account === 'VR' ? '🔵 VR' : '🟢 Janta'}
                              </span>}
                            </td>
                          )}
                          <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: t.amount > 0 ? 700 : 400 }}>
                            {t.amount > 0 ? fmt(t.amount) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: t.amount < 0 ? 700 : 400 }}>
                            {t.amount < 0 ? fmt(Math.abs(t.amount)) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: (t.balance_after || 0) >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                            {fmt(t.balance_after || 0)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {isManual(t) && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(t)} title="Edit">✏️</button>}
                              <button className="btn btn-sm"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                onClick={() => handleDelete(t)} title="Delete">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          }
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {activeTab === 'cash' ? '💵' : '📱'} {editItem ? 'Edit' : 'Manual'} {activeTab === 'cash' ? 'Cash' : 'UPI'} Entry
              </span>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.transaction_date} onChange={e => setForm(p => ({ ...p, transaction_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.transaction_type} onChange={e => setForm(p => ({ ...p, transaction_type: e.target.value }))}>
                    <option value="receipt">Receipt (Money In ↑)</option>
                    <option value="payment">Payment (Money Out ↓)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input className="form-control" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input type="number" className="form-control" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} step="0.01" min="0" required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? '💾 Update' : '✅ Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
