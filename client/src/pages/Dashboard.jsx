import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getDashboardSummary, getDashboardAlerts, getDashboardCharts } from '../services/db'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const KPI_CONFIGS = [
  { key: 'total_sales', label: 'Total Sales', icon: '💰', color: '#7C3AED', bg: 'rgba(124,58,237,0.15)', sub: (d) => `${d?.total_bills || 0} bills` },
  { key: 'cash_sales', label: 'Cash Sales', icon: '💵', color: '#10B981', bg: 'rgba(16,185,129,0.15)', sub: () => 'Cash collected' },
  { key: 'upi_sales', label: 'UPI / Digital', icon: '📱', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)', sub: () => 'Online payments' },
  { key: 'credit_sales', label: 'Credit Sales', icon: '🧾', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', sub: () => 'Pending collection' },
  { key: 'gross_profit', label: 'Gross Profit', icon: '📈', color: '#10B981', bg: 'rgba(16,185,129,0.15)', sub: () => 'Today' },
  { key: 'purchases', label: 'Purchases', icon: '🚚', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', sub: () => 'Today' },
  { key: 'expenses', label: 'Expenses', icon: '💸', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', sub: () => 'Today' },
  { key: 'new_customers', label: 'New Customers', icon: '👤', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)', sub: () => 'Today', noRupee: true },
]

const BALANCE_CONFIGS = [
  { key: 'cash', label: 'Cash Balance', icon: '💵', color: '#10B981' },
  { key: 'customer_outstanding', label: 'Customer Owed', icon: '🧾', color: '#F59E0B' },
  { key: 'vendor_outstanding', label: 'Vendor Owed', icon: '🏭', color: '#EF4444' },
]

const PIE_COLORS = ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B']

const QUICK_ACTIONS = [
  { label: 'New Sale', icon: '🛒', path: '/sales/new', color: '#7C3AED' },
  { label: 'New Purchase', icon: '🚚', path: '/purchases/new', color: '#06B6D4' },
  { label: 'Add Product', icon: '👕', path: '/products/new', color: '#10B981' },
  { label: 'Add Customer', icon: '👤', path: '/customers', color: '#F59E0B' },
  { label: 'Add Vendor', icon: '🏭', path: '/vendors', color: '#EF4444' },
  { label: 'Add Expense', icon: '💸', path: '/expenses/misc', color: '#8B5CF6' },
  { label: 'Cash Book', icon: '💵', path: '/finance/cash', color: '#10B981' },
  { label: 'Reports', icon: '📊', path: '/reports', color: '#06B6D4' },
  { label: 'Reminders', icon: '🔔', path: '/reminders', color: '#F59E0B' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>₹{Number(p.value || 0).toLocaleString('en-IN')}</p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [charts, setCharts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getDashboardSummary(),
      getDashboardAlerts(),
      getDashboardCharts(),
    ]).then(([s, a, c]) => {
      setSummary(s)
      setAlerts(a)
      setCharts(c)
    }).finally(() => setLoading(false))
  }, [])

  const today = summary?.today || {}
  const balances = summary?.balances || {}

  const paymentPie = charts?.paymentModes ? [
    { name: 'Cash', value: charts.paymentModes.cash || 0 },
    { name: 'UPI', value: charts.paymentModes.upi || 0 },
    { name: 'Card', value: charts.paymentModes.card || 0 },
    { name: 'Credit', value: charts.paymentModes.credit || 0 },
  ].filter(p => p.value > 0) : []

  if (loading) return (
    <div className="loading-overlay" style={{ height: '60vh' }}>
      <span className="loading-spinner" style={{ width: 32, height: 32 }} />
      <span>Loading dashboard...</span>
    </div>
  )

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>📊 Dashboard</h1>
          <p>Today's business overview — {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>
          ➕ New Sale
        </button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {KPI_CONFIGS.map(cfg => (
          <div key={cfg.key} className="kpi-card" style={{ '--kpi-color': cfg.color, '--kpi-bg': cfg.bg }}>
            <div className="kpi-icon">{cfg.icon}</div>
            <div className="kpi-label">{cfg.label}</div>
            <div className="kpi-value">{cfg.noRupee ? (today[cfg.key] || 0) : fmt(today[cfg.key])}</div>
            <div className="kpi-sub">{cfg.sub(today)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {BALANCE_CONFIGS.map(cfg => (
          <div key={cfg.key} className="card" style={{ background: `rgba(${cfg.color === '#10B981' ? '16,185,129' : cfg.color === '#F59E0B' ? '245,158,11' : '239,68,68'},0.07)`, border: `1px solid rgba(${cfg.color === '#10B981' ? '16,185,129' : cfg.color === '#F59E0B' ? '245,158,11' : '239,68,68'},0.2)` }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32 }}>{cfg.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{cfg.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{fmt(balances[cfg.key])}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 340px', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Sales — Last 7 Days</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts?.sales7Days || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="url(#salesGrad)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Monthly Sales Trend</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={charts?.monthlySales || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Payment Modes</span></div>
          <div className="card-body">
            {paymentPie.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={paymentPie} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                      {paymentPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {paymentPie.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ color: 'var(--text-muted)' }}>{p.name}: </span>
                      <span style={{ fontWeight: 600 }}>{fmt(p.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 32, opacity: 0.3 }}>📊</div>
                <p style={{ fontSize: 12 }}>No sales today</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">🚨 Alerts & Reminders</span>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/reminders')}>View All</button>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div className="alert-panel">
              {alerts?.low_stock?.slice(0, 3).map(p => (
                <div key={`ls-${p.id}`} className="alert-item critical" onClick={() => navigate('/inventory/low-stock')}>
                  <div className="alert-dot red" />
                  <div className="alert-text">
                    <div>⚠️ Low Stock: <strong>{p.name}</strong></div>
                    <div className="alert-meta">Stock: {p.total_stock} (Min: {p.min_stock_level})</div>
                  </div>
                </div>
              ))}
              {alerts?.vendor_payments_due?.slice(0, 2).map(v => (
                <div key={`vd-${v.id}`} className={`alert-item ${v.urgency === 'overdue' ? 'critical' : 'warning'}`} onClick={() => navigate('/vendors')}>
                  <div className={`alert-dot ${v.urgency === 'overdue' ? 'red' : 'yellow'}`} />
                  <div className="alert-text">
                    <div>💳 {v.urgency === 'overdue' ? 'Overdue' : 'Due Soon'}: {v.vendor_name}</div>
                    <div className="alert-meta">{fmt(v.outstanding_amount)} · Due: {v.due_date}</div>
                  </div>
                </div>
              ))}
              {alerts?.electricity_due?.slice(0, 1).map(e => (
                <div key={`el-${e.id}`} className="alert-item warning" onClick={() => navigate('/expenses/electricity')}>
                  <div className="alert-dot yellow" />
                  <div className="alert-text">
                    <div>⚡ Electricity Bill Due</div>
                    <div className="alert-meta">{fmt(e.bill_amount)} · Due: {e.due_date}</div>
                  </div>
                </div>
              ))}
              {alerts?.rent_due?.slice(0, 1).map(r => (
                <div key={`rt-${r.id}`} className="alert-item warning" onClick={() => navigate('/expenses/rent')}>
                  <div className="alert-dot yellow" />
                  <div className="alert-text">
                    <div>🏠 Shop Rent Due</div>
                    <div className="alert-meta">{fmt(r.amount)} · Due: {r.due_date}</div>
                  </div>
                </div>
              ))}
              {(!alerts?.low_stock?.length && !alerts?.vendor_payments_due?.length && !alerts?.electricity_due?.length && !alerts?.rent_due?.length) && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  ✅ No urgent alerts
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">⚡ Quick Actions</span>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div className="quick-actions">
              {QUICK_ACTIONS.map(a => (
                <div key={a.path} className="quick-action" onClick={() => navigate(a.path)}>
                  <div className="quick-action-icon" style={{ background: `${a.color}22`, borderColor: `${a.color}44` }}>
                    <span style={{ fontSize: 22 }}>{a.icon}</span>
                  </div>
                  <span className="quick-action-label">{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">🏆 Top Products (This Month)</span>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/reports')}>Reports</button>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {charts?.topProducts?.length > 0 ? (
              <table className="table">
                <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
                <tbody>
                  {charts.topProducts.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: `hsl(${i * 60 + 260}, 60%, 40%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{p.product_name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.qty_sold}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 32, opacity: 0.3 }}>📦</div>
                <p style={{ fontSize: 12 }}>No sales data yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">💳 Credit Outstanding</span>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/customers/credit')}>View All</button>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {alerts?.customer_payments_due?.length > 0 ? (
              <table className="table">
                <thead><tr><th>Customer</th><th>Mobile</th><th style={{ textAlign: 'right' }}>Outstanding</th></tr></thead>
                <tbody>
                  {alerts.customer_payments_due.slice(0, 5).map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
                      <td><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.mobile || '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger-light)', fontWeight: 700 }}>{fmt(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 32, opacity: 0.3 }}>✅</div>
                <p style={{ fontSize: 12 }}>No outstanding dues</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
