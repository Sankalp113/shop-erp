import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RefreshProvider } from './context/RefreshContext'
import Layout from './components/Layout'


// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewSale from './pages/sales/NewSale'
import SalesHistory from './pages/sales/SalesHistory'
import SalesReturns from './pages/sales/SalesReturns'
import Products from './pages/products/Products'
import ProductForm from './pages/products/ProductForm'
import StockOverview from './pages/inventory/StockOverview'
import StockAdjustments from './pages/inventory/StockAdjustments'
import LowStock from './pages/inventory/LowStock'
import StockAging from './pages/inventory/StockAging'
import NewPurchase from './pages/purchases/NewPurchase'
import PurchaseHistory from './pages/purchases/PurchaseHistory'
import VendorList from './pages/vendors/VendorList'
import VendorDetail from './pages/vendors/VendorDetail'
import CustomerList from './pages/customers/CustomerList'
import CustomerDetail from './pages/customers/CustomerDetail'
import CreditOutstanding from './pages/customers/CreditOutstanding'
import Employees from './pages/staff/Employees'
import Attendance from './pages/staff/Attendance'
import Salary from './pages/staff/Salary'
import Expenses from './pages/expenses/Expenses'
import Electricity from './pages/expenses/Electricity'
import Rent from './pages/expenses/Rent'
import RecurringExpenses from './pages/expenses/RecurringExpenses'
import CashBook from './pages/finance/CashBook'
import BankAccounts from './pages/finance/BankAccounts'
import Reconciliation from './pages/finance/Reconciliation'
import Reports from './pages/Reports'
import Reminders from './pages/Reminders'
import Documents from './pages/Documents'
import UsersPage from './pages/admin/UsersPage'
import AuditLog from './pages/admin/AuditLog'
import Settings from './pages/admin/Settings'
import CategoriesPage from './pages/admin/CategoriesPage'


function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="sales/new" element={<NewSale />} />
        <Route path="sales/history" element={<SalesHistory />} />
        <Route path="sales/returns" element={<SalesReturns />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="inventory/stock" element={<StockOverview />} />
        <Route path="inventory/adjustments" element={<StockAdjustments />} />
        <Route path="inventory/low-stock" element={<LowStock />} />
        <Route path="inventory/aging" element={<StockAging />} />
        <Route path="purchases/new" element={<NewPurchase />} />
        <Route path="purchases/history" element={<PurchaseHistory />} />
        <Route path="vendors" element={<VendorList />} />
        <Route path="vendors/:id" element={<VendorDetail />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="customers/credit" element={<CreditOutstanding />} />
        <Route path="staff/employees" element={<Employees />} />
        <Route path="staff/attendance" element={<Attendance />} />
        <Route path="staff/salary" element={<Salary />} />
        <Route path="expenses/misc" element={<Expenses />} />
        <Route path="expenses/electricity" element={<Electricity />} />
        <Route path="expenses/rent" element={<Rent />} />
        <Route path="expenses/recurring" element={<RecurringExpenses />} />
        <Route path="finance/cash" element={<CashBook />} />
        <Route path="finance/bank" element={<BankAccounts />} />
        <Route path="finance/reconciliation" element={<Reconciliation />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="documents" element={<Documents />} />
        <Route path="admin/users" element={<UsersPage />} />
        <Route path="admin/audit" element={<AuditLog />} />
        <Route path="admin/settings" element={<Settings />} />
        <Route path="admin/categories" element={<CategoriesPage />} />

      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <RefreshProvider>
        <AppRoutes />
      </RefreshProvider>
    </AuthProvider>
  )
}
