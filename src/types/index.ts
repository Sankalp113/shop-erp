// Shared TypeScript types for the Cloth Shop ERP system

export type UserRole = 'owner' | 'admin' | 'manager' | 'billing' | 'inventory' | 'accountant'

export interface UserProfile {
  uid: string
  name: string
  email: string
  mobile?: string
  role: UserRole
  branchId?: string
  status: 'active' | 'inactive'
  photoURL?: string
  createdAt?: any
  lastLogin?: any
}

// ── PRODUCTS ────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  parentId?: string
  isActive: boolean
  createdAt?: any
}

export interface Brand {
  id: string
  name: string
  isActive: boolean
  createdAt?: any
}

export interface Product {
  id: string
  code: string
  name: string
  sku?: string
  categoryId?: string
  categoryName?: string
  brandId?: string
  brandName?: string
  vendorId?: string
  description?: string
  purchasePrice: number
  sellingPrice: number
  mrp?: number
  taxRate: number
  discountPercent: number
  minStock: number
  location?: string
  imageUrl?: string
  hasVariants: boolean
  isActive: boolean
  branchId?: string
  createdAt?: any
  updatedAt?: any
}

export interface ProductVariant {
  id: string
  productId: string
  productName?: string
  size?: string
  color?: string
  sku?: string
  barcode?: string
  purchasePrice?: number
  sellingPrice?: number
  currentStock: number
  isActive: boolean
}

// ── CUSTOMERS ────────────────────────────────────────────────────

export interface Customer {
  id: string
  code?: string
  name: string
  mobile?: string
  email?: string
  address?: string
  city?: string
  creditLimit: number
  outstanding: number
  totalPurchases: number
  totalPaid: number
  lastPurchaseDate?: string
  isActive: boolean
  branchId?: string
  createdAt?: any
}

// ── VENDORS ────────────────────────────────────────────────────

export interface Vendor {
  id: string
  code?: string
  name: string
  companyName?: string
  contactPerson?: string
  mobile?: string
  email?: string
  address?: string
  city?: string
  gstin?: string
  bankName?: string
  bankAccount?: string
  bankIfsc?: string
  paymentTerms: number
  outstanding: number
  openingBalance: number
  isActive: boolean
  branchId?: string
  createdAt?: any
}

// ── SALES ────────────────────────────────────────────────────

export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit' | 'split'

export interface SaleItem {
  id?: string
  productId: string
  variantId?: string
  productName: string
  size?: string
  color?: string
  qty: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxPercent: number
  taxAmount: number
  totalPrice: number
  purchasePrice: number
}

export interface Sale {
  id: string
  invoiceNumber: string
  saleDate: string
  customerId?: string
  customerName?: string
  customerMobile?: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  creditAmount: number
  paymentMode: PaymentMode
  cashAmount: number
  upiAmount: number
  cardAmount: number
  notes?: string
  status: 'completed' | 'cancelled' | 'returned'
  createdBy: string
  branchId?: string
  createdAt?: any
}

// ── PURCHASES ────────────────────────────────────────────────────

export interface PurchaseItem {
  id?: string
  productId: string
  variantId?: string
  productName: string
  size?: string
  color?: string
  qty: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  totalPrice: number
}

export interface Purchase {
  id: string
  purchaseNumber: string
  vendorInvoiceNumber?: string
  purchaseDate: string
  vendorId?: string
  vendorName?: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  dueDate?: string
  paymentMode?: string
  notes?: string
  status: 'pending' | 'partial' | 'paid'
  createdBy: string
  branchId?: string
  createdAt?: any
}

// ── EXPENSES ────────────────────────────────────────────────────

export interface Expense {
  id: string
  expenseDate: string
  categoryId?: string
  categoryName?: string
  description: string
  amount: number
  paymentMode: string
  vendorPerson?: string
  receiptUrl?: string
  notes?: string
  createdBy: string
  branchId?: string
  createdAt?: any
}

export interface ElectricityBill {
  id: string
  consumerNumber?: string
  meterNumber?: string
  billDate: string
  billingPeriodStart?: string
  billingPeriodEnd?: string
  previousReading: number
  currentReading: number
  unitsConsumed: number
  billAmount: number
  dueDate: string
  paymentDate?: string
  paymentMode?: string
  receiptUrl?: string
  status: 'pending' | 'paid' | 'overdue'
  branchId?: string
  createdAt?: any
}

export interface RentPayment {
  id: string
  rentType: 'monthly' | 'quarterly' | 'annual'
  periodStart: string
  periodEnd?: string
  amount: number
  dueDate: string
  paymentDate?: string
  paymentMode?: string
  landlordName?: string
  status: 'pending' | 'paid'
  receiptUrl?: string
  branchId?: string
  createdAt?: any
}

// ── STAFF ────────────────────────────────────────────────────

export interface Employee {
  id: string
  code: string
  name: string
  mobile?: string
  email?: string
  address?: string
  joiningDate?: string
  designation?: string
  basicSalary: number
  bankName?: string
  bankAccount?: string
  bankIfsc?: string
  status: 'active' | 'inactive' | 'resigned'
  branchId?: string
  createdAt?: any
}

export interface SalaryRecord {
  id: string
  employeeId: string
  employeeName?: string
  salaryMonth: string
  basicSalary: number
  workingDays: number
  presentDays: number
  overtimeHours: number
  overtimeAmount: number
  bonus: number
  incentive: number
  advanceDeduction: number
  leaveDeduction: number
  otherDeduction: number
  netSalary: number
  paidAmount: number
  paymentDate?: string
  paymentMode?: string
  status: 'pending' | 'paid' | 'partial'
  branchId?: string
  createdAt?: any
}

// ── REMINDERS ────────────────────────────────────────────────────

export type ReminderStatus = 'upcoming' | 'due_soon' | 'due_today' | 'overdue' | 'completed' | 'dismissed'
export type ReminderType = 'vendor_payment' | 'customer_payment' | 'electricity' | 'rent' | 'salary' | 'custom' | 'stock'

export interface Reminder {
  id: string
  reminderType: ReminderType
  referenceId?: string
  title: string
  description?: string
  dueDate: string
  amount?: number
  status: ReminderStatus
  priority: 'low' | 'normal' | 'high' | 'critical'
  branchId?: string
  createdAt?: any
  completedAt?: any
}

// ── FINANCE ────────────────────────────────────────────────────

export interface CashTransaction {
  id: string
  transactionDate: string
  transactionType: string
  referenceType?: string
  referenceId?: string
  description: string
  amount: number
  balanceAfter: number
  createdBy: string
  createdAt?: any
}

export interface BankAccount {
  id: string
  accountName: string
  bankName: string
  accountNumber?: string
  ifscCode?: string
  currentBalance: number
  openingBalance: number
  isActive: boolean
  branchId?: string
  createdAt?: any
}

// ── DOCUMENTS ────────────────────────────────────────────────────

export interface Document {
  id: string
  documentType: string
  relatedModule?: string
  relatedRecordId?: string
  title: string
  fileName: string
  fileUrl: string
  fileSize?: number
  tags?: string
  notes?: string
  uploadedBy: string
  uploadedByName?: string
  branchId?: string
  createdAt?: any
}

// ── DASHBOARD ────────────────────────────────────────────────────

export interface DashboardSummary {
  totalSales: number
  totalBills: number
  cashSales: number
  upiSales: number
  cardSales: number
  creditSales: number
  totalPurchases: number
  totalExpenses: number
  grossProfit: number
  cashBalance: number
  bankBalance: number
  customerOutstanding: number
  vendorOutstanding: number
  lowStockCount: number
  date: string
}

// ── SETTINGS ────────────────────────────────────────────────────

export interface ShopSettings {
  shopName: string
  shopAddress: string
  shopCity?: string
  shopMobile: string
  shopEmail?: string
  shopGstin?: string
  shopLogoUrl?: string
  invoicePrefix: string
  currencySymbol: string
  financialYearStart: string
  lowStockDefaultMin: number
  enableNegativeStock: boolean
  dateFormat: string
  timezone: string
}
