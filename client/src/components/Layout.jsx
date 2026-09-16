import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const NAV = [
  { label: 'Dashboard', icon: '📊', path: '/' },
  {
    label: 'Sales', icon: '🛒', children: [
      { label: 'New Bill / POS', path: '/sales/new', icon: '➕' },
      { label: 'Sales History', path: '/sales/history', icon: '📋' },
      { label: 'Returns / Exchange', path: '/sales/returns', icon: '↩️' },
    ]
  },
  {
    label: 'Products & Stock', icon: '👕', children: [
      { label: 'Products', path: '/products', icon: '🏷️' },
      { label: 'Stock Overview', path: '/inventory/stock', icon: '📦' },
      { label: 'Stock Adjustments', path: '/inventory/adjustments', icon: '⚖️' },
      { label: 'Low Stock', path: '/inventory/low-stock', icon: '⚠️' },
      { label: 'Stock Aging', path: '/inventory/aging', icon: '📅' },
    ]
  },
  {
    label: 'Purchases', icon: '🚚', children: [
      { label: 'New Purchase', path: '/purchases/new', icon: '➕' },
      { label: 'Purchase History', path: '/purchases/history', icon: '📋' },
    ]
  },
  {
    label: 'Vendors', icon: '🏭', children: [
      { label: 'Vendor List', path: '/vendors', icon: '📇' },
    ]
  },
  {
    label: 'Customers', icon: '👥', children: [
      { label: 'Customer List', path: '/customers', icon: '📇' },
      { label: 'Credit Outstanding', path: '/customers/credit', icon: '💳' },
    ]
  },
  {
    label: 'Staff', icon: '👷', children: [
      { label: 'Employees', path: '/staff/employees', icon: '🪪' },
      { label: 'Attendance', path: '/staff/attendance', icon: '✅' },
      { label: 'Salary', path: '/staff/salary', icon: '💰' },
    ]
  },
  {
    label: 'Expenses', icon: '💸', children: [
      { label: 'Miscellaneous', path: '/expenses/misc', icon: '🗂️' },
      { label: 'Electricity', path: '/expenses/electricity', icon: '⚡' },
      { label: 'Rent', path: '/expenses/rent', icon: '🏠' },
      { label: 'Recurring', path: '/expenses/recurring', icon: '🔄' },
    ]
  },
  {
    label: 'Accounts', icon: '🏦', children: [
      { label: 'Cash Book', path: '/finance/cash', icon: '💵' },
      { label: 'Bank Accounts', path: '/finance/bank', icon: '🏧' },
      { label: 'Reconciliation', path: '/finance/reconciliation', icon: '🔍' },
    ]
  },
  { label: 'Reports', icon: '📈', path: '/reports' },
  { label: 'Reminders', icon: '🔔', path: '/reminders', badge: 'alerts' },
  { label: 'Documents', icon: '📁', path: '/documents' },
  {
    label: 'Admin', icon: '⚙️', children: [
      { label: 'Users & Roles', path: '/admin/users', icon: '👤' },
      { label: 'Audit Log', path: '/admin/audit', icon: '🔍' },
      { label: 'Settings', path: '/admin/settings', icon: '⚙️' },
    ]
  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [alertCount, setAlertCount] = useState(0)

  // Auto-open the group that contains the current path
  useEffect(() => {
    NAV.forEach((item) => {
      if (item.children?.some(c => location.pathname.startsWith(c.path))) {
        setOpenGroups(prev => ({ ...prev, [item.label]: true }))
      }
    })
  }, [location.pathname])

  useEffect(() => {
    api.get('/reminders/notifications').then(r => setAlertCount(r.data.unread_count)).catch(() => {})
  }, [])

  function toggleGroup(label) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isActive(path) {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  function navTo(path) {
    navigate(path)
    setMobileOpen(false)
  }

  const initials = user?.full_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 150, backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">👗</div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              <h1>Cloth Shop ERP</h1>
              <p>Business Management</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => {
            if (!item.children) {
              return (
                <div
                  key={item.label}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => navTo(item.path)}
                  title={collapsed ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge === 'alerts' && alertCount > 0 && (
                    <span className="nav-badge">{alertCount > 99 ? '99+' : alertCount}</span>
                  )}
                </div>
              )
            }
            return (
              <div key={item.label}>
                <div
                  className={`nav-item ${item.children.some(c => isActive(c.path)) ? 'active' : ''}`}
                  onClick={() => !collapsed && toggleGroup(item.label)}
                  title={collapsed ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {!collapsed && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', transform: openGroups[item.label] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  )}
                </div>
                {!collapsed && (
                  <div className={`nav-sub ${openGroups[item.label] ? 'open' : ''}`}>
                    {item.children.map(child => (
                      <div
                        key={child.path}
                        className={`nav-sub-item ${isActive(child.path) ? 'active' : ''}`}
                        onClick={() => navTo(child.path)}
                      >
                        <span>{child.icon}</span>
                        <span>{child.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" onClick={logout}>
            <div className="user-avatar-sm">{initials}</div>
            {!collapsed && (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div className="user-name">{user?.full_name}</div>
                <div className="user-role">{user?.role} · Logout</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className={`main-content ${collapsed ? 'expanded' : ''}`}>
        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => { setCollapsed(p => !p); setMobileOpen(p => !p) }}>☰</button>

          <div className="topbar-actions" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="topbar-title" style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>

            <button className="topbar-icon-btn" onClick={() => navTo('/sales/new')} title="New Sale" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-light))', color: 'white', borderRadius: 8, padding: '0 12px', width: 'auto', fontSize: 12, fontWeight: 600, gap: 6, display: 'flex', alignItems: 'center' }}>
              ➕ New Sale
            </button>

            <button className="topbar-icon-btn" onClick={() => navTo('/reminders')} title="Reminders">
              🔔
              {alertCount > 0 && <span className="topbar-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
            </button>

            <div className="topbar-avatar" onClick={() => navTo('/admin/settings')} title={user?.full_name}>
              {initials}
            </div>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
