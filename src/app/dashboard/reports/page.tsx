'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, currentMonth } from '@/lib/utils'
import {
  BarChart3, TrendingUp, ShoppingBag, DollarSign, Users, Package,
  Download, FileSpreadsheet, Truck, Store, UserCheck, Wallet,
  Zap, Home, ClipboardList, Bell, FolderOpen, Shield, RotateCcw,
  ArrowLeftRight, BookOpen, Activity, Calendar, ChevronRight
} from 'lucide-react'

// ── Report categories ─────────────────────────────────────────────────────────
const REPORT_GROUPS = [
  {
    label: 'Sales', color: '#7C3AED', icon: <ShoppingBag size={15}/>,
    reports: [
      { id: 'sales', label: 'Sales / Billing', icon: <ShoppingBag size={14}/> },
      { id: 'sales_returns', label: 'Sales Returns', icon: <RotateCcw size={14}/> },
      { id: 'profit_margin', label: 'Profit Margin', icon: <TrendingUp size={14}/> },
    ]
  },
  {
    label: 'Purchases', color: '#0891B2', icon: <Truck size={15}/>,
    reports: [
      { id: 'purchases', label: 'Purchase Report', icon: <Truck size={14}/> },
      { id: 'purchase_returns', label: 'Purchase Returns', icon: <RotateCcw size={14}/> },
    ]
  },
  {
    label: 'Inventory', color: '#059669', icon: <Package size={15}/>,
    reports: [
      { id: 'inventory', label: 'Stock Report', icon: <Package size={14}/> },
      { id: 'stock_ledger', label: 'Stock Ledger', icon: <BookOpen size={14}/> },
      { id: 'stock_aging', label: 'Stock Aging', icon: <Calendar size={14}/> },
      { id: 'low_stock', label: 'Low Stock Alert', icon: <Bell size={14}/> },
    ]
  },
  {
    label: 'Parties', color: '#D97706', icon: <Users size={15}/>,
    reports: [
      { id: 'vendor_ledger', label: 'Vendor Ledger', icon: <Store size={14}/> },
      { id: 'vendor_payments', label: 'Vendor Payments', icon: <Wallet size={14}/> },
      { id: 'customer_ledger', label: 'Customer Credit', icon: <Users size={14}/> },
      { id: 'customer_collections', label: 'Collections', icon: <DollarSign size={14}/> },
    ]
  },
  {
    label: 'Expenses', color: '#DC2626', icon: <DollarSign size={15}/>,
    reports: [
      { id: 'expenses', label: 'All Expenses', icon: <DollarSign size={14}/> },
      { id: 'electricity', label: 'Electricity Bills', icon: <Zap size={14}/> },
      { id: 'rent', label: 'Shop Rent', icon: <Home size={14}/> },
    ]
  },
  {
    label: 'Staff', color: '#7C3AED', icon: <UserCheck size={15}/>,
    reports: [
      { id: 'salary', label: 'Salary / Payroll', icon: <UserCheck size={14}/> },
      { id: 'attendance', label: 'Attendance', icon: <ClipboardList size={14}/> },
    ]
  },
  {
    label: 'Accounts', color: '#0891B2', icon: <Wallet size={15}/>,
    reports: [
      { id: 'cash_book', label: 'Cash Book', icon: <Wallet size={14}/> },
      { id: 'bank_upi', label: 'Bank / UPI', icon: <ArrowLeftRight size={14}/> },
      { id: 'daily_summary', label: 'Daily Summary', icon: <Activity size={14}/> },
    ]
  },
  {
    label: 'Others', color: '#6B7280', icon: <FolderOpen size={15}/>,
    reports: [
      { id: 'reminders', label: 'Reminders', icon: <Bell size={14}/> },
      { id: 'documents', label: 'Documents', icon: <FolderOpen size={14}/> },
      { id: 'audit_log', label: 'Audit Log', icon: <Shield size={14}/> },
    ]
  },
]

type ReportId = string

// ── Column definitions per report ─────────────────────────────────────────────
const REPORT_COLS: Record<string, { label: string; key: string; currency?: boolean; date?: boolean; right?: boolean }[]> = {
  sales: [
    { label: 'Invoice No.', key: 'invoiceNumber' },
    { label: 'Date', key: 'saleDate', date: true },
    { label: 'Customer', key: 'customerName' },
    { label: 'Staff', key: 'staffName' },
    { label: 'Payment Mode', key: 'paymentMode' },
    { label: 'Total Amount', key: 'totalAmount', currency: true, right: true },
    { label: 'Discount', key: 'discountAmount', currency: true, right: true },
    { label: 'Cost', key: 'totalCost', currency: true, right: true },
    { label: 'Profit', key: '_profit', currency: true, right: true },
    { label: 'Branch', key: 'branch' },
  ],
  sales_returns: [
    { label: 'Return No.', key: 'returnNumber' },
    { label: 'Return Date', key: 'returnDate', date: true },
    { label: 'Invoice No.', key: 'invoiceNumber' },
    { label: 'Customer', key: 'customerName' },
    { label: 'Reason', key: 'reason' },
    { label: 'Refund Amount', key: 'refundAmount', currency: true, right: true },
    { label: 'Payment Mode', key: 'paymentMode' },
    { label: 'Status', key: 'status' },
  ],
  purchases: [
    { label: 'Purchase No.', key: 'purchaseNumber' },
    { label: 'Date', key: 'purchaseDate', date: true },
    { label: 'Vendor', key: 'vendorName' },
    { label: 'Total Amount', key: 'totalAmount', currency: true, right: true },
    { label: 'Paid Amount', key: 'paidAmount', currency: true, right: true },
    { label: 'Outstanding', key: 'outstandingAmount', currency: true, right: true },
    { label: 'Due Date', key: 'dueDate', date: true },
    { label: 'Status', key: 'status' },
  ],
  purchase_returns: [
    { label: 'Return No.', key: 'returnNumber' },
    { label: 'Return Date', key: 'returnDate', date: true },
    { label: 'Purchase No.', key: 'purchaseNumber' },
    { label: 'Vendor', key: 'vendorName' },
    { label: 'Qty Returned', key: 'quantity', right: true },
    { label: 'Refund Amount', key: 'refundAmount', currency: true, right: true },
    { label: 'Reason', key: 'reason' },
  ],
  inventory: [
    { label: 'Product ID', key: 'id' },
    { label: 'Product Name', key: 'name' },
    { label: 'Category', key: 'category' },
    { label: 'Brand', key: 'brand' },
    { label: 'Size', key: 'size' },
    { label: 'Color', key: 'color' },
    { label: 'Current Stock', key: 'quantity', right: true },
    { label: 'Reorder Level', key: 'reorderLevel', right: true },
    { label: 'Purchase Price', key: 'purchasePrice', currency: true, right: true },
    { label: 'Selling Price', key: 'sellingPrice', currency: true, right: true },
    { label: 'Stock Value', key: '_stockValue', currency: true, right: true },
  ],
  stock_ledger: [
    { label: 'Date', key: 'date', date: true },
    { label: 'Product', key: 'productName' },
    { label: 'Type', key: 'transactionType' },
    { label: 'Reference', key: 'referenceNo' },
    { label: 'Qty In', key: 'quantityIn', right: true },
    { label: 'Qty Out', key: 'quantityOut', right: true },
    { label: 'Balance', key: 'balanceQty', right: true },
    { label: 'Amount', key: 'amount', currency: true, right: true },
  ],
  stock_aging: [
    { label: 'Product', key: 'name' },
    { label: 'Category', key: 'category' },
    { label: 'Current Qty', key: 'quantity', right: true },
    { label: 'Stock Value', key: '_stockValue', currency: true, right: true },
    { label: 'Last Sale Date', key: 'lastSaleDate', date: true },
    { label: 'Days Since Sale', key: '_days', right: true },
    { label: 'Aging Bucket', key: '_agingBucket' },
    { label: 'Suggested Action', key: '_action' },
  ],
  low_stock: [
    { label: 'Product', key: 'name' },
    { label: 'Category', key: 'category' },
    { label: 'Size', key: 'size' },
    { label: 'Color', key: 'color' },
    { label: 'Current Qty', key: 'quantity', right: true },
    { label: 'Reorder Level', key: 'reorderLevel', right: true },
    { label: 'Suggested Order', key: '_suggested', right: true },
    { label: 'Status', key: '_status' },
  ],
  vendor_ledger: [
    { label: 'Vendor', key: 'name' },
    { label: 'Mobile', key: 'mobile' },
    { label: 'GSTIN', key: 'gstin' },
    { label: 'Total Purchases', key: 'totalPurchases', currency: true, right: true },
    { label: 'Payments Made', key: 'totalPaid', currency: true, right: true },
    { label: 'Outstanding', key: 'outstanding', currency: true, right: true },
    { label: 'Next Due Date', key: 'nextDueDate', date: true },
    { label: 'Status', key: 'status' },
  ],
  vendor_payments: [
    { label: 'Payment ID', key: 'id' },
    { label: 'Date', key: 'paymentDate', date: true },
    { label: 'Vendor', key: 'vendorName' },
    { label: 'Amount Paid', key: 'amount', currency: true, right: true },
    { label: 'Payment Mode', key: 'paymentMode' },
    { label: 'Remaining', key: 'remainingOutstanding', currency: true, right: true },
    { label: 'Status', key: 'status' },
  ],
  customer_ledger: [
    { label: 'Customer', key: 'name' },
    { label: 'Mobile', key: 'mobile' },
    { label: 'Credit Limit', key: 'creditLimit', currency: true, right: true },
    { label: 'Credit Sales', key: 'creditSales', currency: true, right: true },
    { label: 'Payments Received', key: 'paymentsReceived', currency: true, right: true },
    { label: 'Outstanding', key: 'outstanding', currency: true, right: true },
    { label: 'Last Payment', key: 'lastPaymentDate', date: true },
    { label: 'Follow-up Date', key: 'followUpDate', date: true },
    { label: 'Status', key: 'status' },
  ],
  customer_collections: [
    { label: 'Receipt No.', key: 'receiptNumber' },
    { label: 'Date', key: 'receiptDate', date: true },
    { label: 'Customer', key: 'customerName' },
    { label: 'Amount Received', key: 'amount', currency: true, right: true },
    { label: 'Payment Mode', key: 'paymentMode' },
    { label: 'Remaining', key: 'remaining', currency: true, right: true },
    { label: 'Collected By', key: 'collectedBy' },
  ],
  profit_margin: [
    { label: 'Product', key: 'name' },
    { label: 'Category', key: 'category' },
    { label: 'Qty Sold', key: 'qtySold', right: true },
    { label: 'Revenue', key: 'revenue', currency: true, right: true },
    { label: 'Discount', key: 'discount', currency: true, right: true },
    { label: 'Net Sales', key: 'netSales', currency: true, right: true },
    { label: 'COGS', key: 'cogs', currency: true, right: true },
    { label: 'Gross Profit', key: 'grossProfit', currency: true, right: true },
    { label: 'Margin %', key: '_margin', right: true },
  ],
  expenses: [
    { label: 'Expense ID', key: 'id' },
    { label: 'Date', key: 'expenseDate', date: true },
    { label: 'Category', key: 'categoryName' },
    { label: 'Description', key: 'description' },
    { label: 'Payee', key: 'payee' },
    { label: 'Amount', key: 'amount', currency: true, right: true },
    { label: 'Payment Mode', key: 'paymentMode' },
    { label: 'Status', key: 'status' },
  ],
  electricity: [
    { label: 'Bill ID', key: 'id' },
    { label: 'Billing Month', key: 'billingMonth' },
    { label: 'Bill Date', key: 'billDate', date: true },
    { label: 'Due Date', key: 'dueDate', date: true },
    { label: 'Units Consumed', key: 'unitsConsumed', right: true },
    { label: 'Bill Amount', key: 'billAmount', currency: true, right: true },
    { label: 'Late Fee', key: 'lateFee', currency: true, right: true },
    { label: 'Total Paid', key: 'totalPaid', currency: true, right: true },
    { label: 'Status', key: 'status' },
  ],
  rent: [
    { label: 'Rent ID', key: 'id' },
    { label: 'Month', key: 'month' },
    { label: 'Property', key: 'propertyName' },
    { label: 'Landlord', key: 'landlord' },
    { label: 'Due Date', key: 'dueDate', date: true },
    { label: 'Rent Amount', key: 'rentAmount', currency: true, right: true },
    { label: 'Late Fee', key: 'lateFee', currency: true, right: true },
    { label: 'Total Paid', key: 'totalPaid', currency: true, right: true },
    { label: 'Status', key: 'status' },
  ],
  salary: [
    { label: 'Salary Month', key: 'salaryMonth' },
    { label: 'Employee', key: 'employeeName' },
    { label: 'Basic Salary', key: 'basicSalary', currency: true, right: true },
    { label: 'Attendance Days', key: 'attendanceDays', right: true },
    { label: 'Overtime', key: 'overtime', currency: true, right: true },
    { label: 'Commission', key: 'commission', currency: true, right: true },
    { label: 'Deductions', key: 'deductions', currency: true, right: true },
    { label: 'Net Salary', key: 'netSalary', currency: true, right: true },
    { label: 'Status', key: 'status' },
  ],
  attendance: [
    { label: 'Date', key: 'date', date: true },
    { label: 'Employee', key: 'employeeName' },
    { label: 'In Time', key: 'inTime' },
    { label: 'Out Time', key: 'outTime' },
    { label: 'Status', key: 'attendanceStatus' },
    { label: 'Leave Type', key: 'leaveType' },
    { label: 'Overtime Hrs', key: 'overtimeHours', right: true },
  ],
  cash_book: [
    { label: 'Date', key: 'date', date: true },
    { label: 'Description', key: 'description' },
    { label: 'Type', key: 'transactionType' },
    { label: 'Reference', key: 'referenceNo' },
    { label: 'Cash In', key: 'cashIn', currency: true, right: true },
    { label: 'Cash Out', key: 'cashOut', currency: true, right: true },
    { label: 'Balance', key: 'balance', currency: true, right: true },
    { label: 'Payment Mode', key: 'paymentMode' },
  ],
  bank_upi: [
    { label: 'Date', key: 'date', date: true },
    { label: 'Account/UPI ID', key: 'accountId' },
    { label: 'Description', key: 'description' },
    { label: 'Type', key: 'transactionType' },
    { label: 'Credit', key: 'credit', currency: true, right: true },
    { label: 'Debit', key: 'debit', currency: true, right: true },
    { label: 'Balance', key: 'balance', currency: true, right: true },
    { label: 'Provider', key: 'provider' },
  ],
  daily_summary: [
    { label: 'Date', key: 'summaryDate', date: true },
    { label: 'Total Sales', key: 'totalSales', currency: true, right: true },
    { label: 'Bills Count', key: 'billsCount', right: true },
    { label: 'Cash Sales', key: 'cashSales', currency: true, right: true },
    { label: 'UPI Sales', key: 'upiSales', currency: true, right: true },
    { label: 'Credit Sales', key: 'creditSales', currency: true, right: true },
    { label: 'Purchases', key: 'purchases', currency: true, right: true },
    { label: 'Expenses', key: 'expenses', currency: true, right: true },
    { label: 'Gross Profit', key: 'grossProfit', currency: true, right: true },
    { label: 'Cash Balance', key: 'cashBalance', currency: true, right: true },
    { label: 'Status', key: 'status' },
  ],
  reminders: [
    { label: 'Type', key: 'reminderType' },
    { label: 'Party Name', key: 'partyName' },
    { label: 'Due Date', key: 'dueDate', date: true },
    { label: 'Amount Due', key: 'amountDue', currency: true, right: true },
    { label: 'Days Overdue', key: '_daysOverdue', right: true },
    { label: 'Priority', key: 'priority' },
    { label: 'Status', key: 'status' },
    { label: 'Assigned To', key: 'assignedTo' },
  ],
  documents: [
    { label: 'Document ID', key: 'id' },
    { label: 'Type', key: 'documentType' },
    { label: 'Description', key: 'description' },
    { label: 'File Name', key: 'fileName' },
    { label: 'Uploaded Date', key: 'uploadedDate', date: true },
    { label: 'Uploaded By', key: 'uploadedBy' },
    { label: 'Expiry Date', key: 'expiryDate', date: true },
    { label: 'Status', key: 'status' },
  ],
  audit_log: [
    { label: 'Timestamp', key: 'timestamp' },
    { label: 'User', key: 'userName' },
    { label: 'Role', key: 'role' },
    { label: 'Module', key: 'module' },
    { label: 'Action', key: 'action' },
    { label: 'Record ID', key: 'recordId' },
    { label: 'Old Value', key: 'oldValue' },
    { label: 'New Value', key: 'newValue' },
  ],
}

// Firestore collection map
const COLLECTION_MAP: Record<string, string> = {
  sales: 'sales', sales_returns: 'salesReturns', purchases: 'purchases',
  purchase_returns: 'purchaseReturns', inventory: 'products', stock_ledger: 'stockLedger',
  stock_aging: 'products', low_stock: 'products', vendor_ledger: 'vendors',
  vendor_payments: 'vendorPayments', customer_ledger: 'customers',
  customer_collections: 'customerCollections', profit_margin: 'products',
  expenses: 'expenses', electricity: 'electricityBills', rent: 'rentBills',
  salary: 'salaryRecords', attendance: 'attendance', cash_book: 'cashBook',
  bank_upi: 'bankTransactions', daily_summary: 'dailySummaries',
  reminders: 'reminders', documents: 'documents', audit_log: 'auditLogs',
}

function getCellValue(row: any, key: string): string | number {
  if (key === '_profit') return (row.totalAmount || 0) - (row.totalCost || 0)
  if (key === '_stockValue') return (row.quantity || 0) * (row.purchasePrice || 0)
  if (key === '_days') {
    if (!row.lastSaleDate) return 'Never'
    const d = Math.floor((Date.now() - new Date(row.lastSaleDate).getTime()) / 86400000)
    return d
  }
  if (key === '_agingBucket') {
    const d = row.lastSaleDate
      ? Math.floor((Date.now() - new Date(row.lastSaleDate).getTime()) / 86400000)
      : 9999
    if (d === 9999) return 'Never Sold'
    if (d <= 30) return '0-30 Days'
    if (d <= 60) return '31-60 Days'
    if (d <= 90) return '61-90 Days'
    return '90+ Days'
  }
  if (key === '_action') {
    const d = row.lastSaleDate
      ? Math.floor((Date.now() - new Date(row.lastSaleDate).getTime()) / 86400000)
      : 9999
    if (d <= 30) return 'Monitor'
    if (d <= 60) return 'Discount'
    if (d <= 90) return 'Heavy Discount'
    return 'Clearance Sale'
  }
  if (key === '_status') return (row.quantity || 0) <= (row.reorderLevel || 5) ? '🔴 Low Stock' : '🟢 OK'
  if (key === '_suggested') return Math.max(0, (row.reorderLevel || 5) * 2 - (row.quantity || 0))
  if (key === '_margin') {
    const net = (row.netSales || 0)
    return net > 0 ? `${((row.grossProfit || 0) / net * 100).toFixed(1)}%` : '—'
  }
  if (key === '_daysOverdue') {
    if (!row.dueDate) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(row.dueDate).getTime()) / 86400000))
  }
  return row[key] ?? '—'
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportId>('sales')
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setData([])
    setSummary({})
    try {
      const col = COLLECTION_MAP[activeReport]
      if (!col) { setLoading(false); return }

      let q
      const dateField: Record<string, string> = {
        sales: 'saleDate', expenses: 'expenseDate', purchases: 'purchaseDate',
        salary: 'salaryMonth', attendance: 'date', electricity: 'billDate',
        rent: 'month', daily_summary: 'summaryDate', cash_book: 'date',
        bank_upi: 'date', audit_log: 'timestamp',
      }
      const df = dateField[activeReport]

      if (df && (activeReport === 'sales' || activeReport === 'expenses' || activeReport === 'purchases')) {
        q = query(collection(db, col),
          where(df, '>=', `${month}-01`),
          where(df, '<=', `${month}-31`),
          orderBy(df, 'desc'), limit(500))
      } else {
        q = query(collection(db, col), limit(500))
      }

      const snap = await getDocs(q)
      let rows: any[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) }))

      // Computed summary
      if (activeReport === 'sales') {
        setSummary({
          Total: rows.reduce((s, r) => s + (r.totalAmount || 0), 0),
          'Bills Count': rows.length,
          Cash: rows.reduce((s, r) => s + (r.cashAmount || 0), 0),
          UPI: rows.reduce((s, r) => s + (r.upiAmount || 0), 0),
          Credit: rows.reduce((s, r) => s + (r.creditAmount || 0), 0),
          'Gross Profit': rows.reduce((s, r) => s + (r.totalAmount || 0) - (r.totalCost || 0), 0),
        })
      } else if (activeReport === 'expenses') {
        setSummary({ Total: rows.reduce((s, r) => s + (r.amount || 0), 0), Count: rows.length })
      } else if (activeReport === 'purchases') {
        setSummary({
          Total: rows.reduce((s, r) => s + (r.totalAmount || 0), 0),
          Outstanding: rows.reduce((s, r) => s + (r.outstandingAmount || 0), 0),
          Count: rows.length,
        })
      } else if (activeReport === 'inventory' || activeReport === 'stock_aging') {
        setSummary({
          'Total Products': rows.length,
          'Stock Value': rows.reduce((s, r) => s + (r.quantity || 0) * (r.purchasePrice || 0), 0),
          'Low Stock': rows.filter(r => (r.quantity || 0) <= (r.reorderLevel || 5)).length,
        })
      } else if (activeReport === 'vendor_ledger') {
        setSummary({
          'Total Vendors': rows.length,
          Outstanding: rows.reduce((s, r) => s + (r.outstanding || 0), 0),
        })
      } else if (activeReport === 'customer_ledger') {
        setSummary({
          'Total Customers': rows.length,
          Outstanding: rows.reduce((s, r) => s + (r.outstanding || 0), 0),
        })
      }

      setData(rows)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [activeReport, month])

  useEffect(() => { load() }, [load])

  const cols = REPORT_COLS[activeReport] || []
  const activeGroup = REPORT_GROUPS.find(g => g.reports.some(r => r.id === activeReport))
  const activeReportMeta = REPORT_GROUPS.flatMap(g => g.reports).find(r => r.id === activeReport)

  const summaryColors = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#6B7280']

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business intelligence — 25 report formats</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="month" className="form-input w-auto" value={month}
            onChange={e => setMonth(e.target.value)} />
          <a href="/cloth_shop_management_reports.xlsx" download
            className="btn btn-primary flex items-center gap-2">
            <FileSpreadsheet size={15} />
            Download Excel Templates
          </a>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left sidebar — report groups */}
        <div className="w-56 flex-shrink-0 space-y-1">
          {REPORT_GROUPS.map(group => (
            <div key={group.label} className="glass-card p-2">
              <div className="flex items-center gap-2 px-2 py-1 mb-1">
                <span style={{ color: group.color }}>{group.icon}</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{group.label}</span>
              </div>
              {group.reports.map(r => (
                <button key={r.id}
                  onClick={() => setActiveReport(r.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all text-left
                    ${activeReport === r.id
                      ? 'text-white font-semibold'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                  style={activeReport === r.id ? {
                    background: `linear-gradient(90deg, ${group.color}22, transparent)`,
                    color: group.color, borderLeft: `2px solid ${group.color}`
                  } : {}}>
                  {r.icon}
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Report title bar */}
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
            <span>{activeGroup?.label}</span>
            <ChevronRight size={14} />
            <span className="text-white font-semibold">{activeReportMeta?.label}</span>
          </div>

          {/* Summary KPI cards */}
          {Object.keys(summary).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
              {Object.entries(summary).map(([k, v], i) => (
                <div key={k} className="kpi-card" style={{ '--kpi-accent': summaryColors[i % summaryColors.length] } as any}>
                  <p className="text-xs text-gray-500 uppercase tracking-wider truncate">{k}</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {typeof v === 'number' && k !== 'Count' && k !== 'Total Products' && k !== 'Bills Count' && !k.includes('Count') && !k.includes('Low')
                      ? formatCurrency(v)
                      : v.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Data table */}
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="loading-overlay py-24"><div className="spinner spinner-lg" /></div>
            ) : data.length === 0 ? (
              <div className="empty-state py-20">
                <BarChart3 size={48} className="opacity-20 mb-4" />
                <p className="text-gray-500">No data for selected period</p>
                <p className="text-xs text-gray-700 mt-1">Data will appear here once added via the respective module</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      {cols.map(c => (
                        <th key={c.key} className={c.right ? 'text-right' : ''}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="text-center text-gray-600 text-xs">{idx + 1}</td>
                        {cols.map(c => {
                          const val = getCellValue(row, c.key)
                          const isProfit = c.key === '_profit' || c.key === 'grossProfit'
                          const isNeg = typeof val === 'number' && val < 0
                          return (
                            <td key={c.key} className={`${c.right ? 'text-right tabular-nums' : ''} ${isProfit ? (isNeg ? 'text-red-400' : 'text-emerald-400') : ''}`}>
                              {c.currency && typeof val === 'number'
                                ? formatCurrency(val)
                                : c.date && typeof val === 'string'
                                ? formatDate(val)
                                : String(val)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Excel download note */}
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <Download size={12} />
            <span>Download the Excel template above to get all 25 report formats with formulas, filters, and 200-row capacity for offline use.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
