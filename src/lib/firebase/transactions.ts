import {
  doc, collection, writeBatch, runTransaction,
  serverTimestamp, increment, getDoc, addDoc,
} from 'firebase/firestore'
import { db } from './config'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

async function writeAudit(
  batch: ReturnType<typeof writeBatch>,
  userId: string,
  userName: string,
  action: 'CREATE' | 'EDIT' | 'DELETE',
  module: string,
  recordId: string,
  details?: Record<string, any>
) {
  const auditRef = doc(collection(db, 'auditLogs'))
  batch.set(auditRef, {
    userId, userName, action, module, recordId,
    details: details ?? null,
    createdAt: serverTimestamp(),
  })
}

// ── Sale Transaction ──────────────────────────────────────────────────────────
// Atomically: write sale + decrement stock + update customer O/S + update dailySummary + audit

export interface SalePayload {
  id?: string              // if editing an existing sale
  saleDate: string
  customerName?: string
  customerId?: string
  paymentMode: 'cash' | 'upi' | 'card' | 'credit'
  totalAmount: number
  totalCost: number
  items?: { productId: string; quantity: number }[]
  // any other fields
  [key: string]: any
}

export async function saveSaleTransaction(
  data: SalePayload,
  userId: string,
  userName: string,
  oldData?: SalePayload   // pass when editing, to reverse old effects
): Promise<string> {
  const batch   = writeBatch(db)
  const isEdit  = !!data.id
  const saleRef = isEdit ? doc(db, 'sales', data.id!) : doc(collection(db, 'sales'))
  const date    = data.saleDate || todayStr()

  // 1. Sale record
  batch.set(saleRef, {
    ...data,
    id: undefined,           // don't store id inside doc
    version: increment(1),
    updatedAt: serverTimestamp(),
    ...(isEdit ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true })

  // 2. Stock adjustment
  for (const item of data.items || []) {
    const pRef = doc(db, 'products', item.productId)
    const oldQty = oldData?.items?.find(i => i.productId === item.productId)?.quantity ?? 0
    const delta = isEdit ? (oldQty - item.quantity) : -item.quantity
    batch.update(pRef, {
      currentStock: increment(delta),
      lastSaleDate: date,
      updatedAt: serverTimestamp(),
    })
  }

  // 3. Customer outstanding
  if (data.paymentMode === 'credit' && data.customerId) {
    const custRef = doc(db, 'customers', data.customerId)
    const oldCredit = (oldData?.paymentMode === 'credit' && oldData?.customerId === data.customerId)
      ? (oldData?.totalAmount ?? 0) : 0
    batch.update(custRef, {
      outstanding: increment(data.totalAmount - oldCredit),
      updatedAt: serverTimestamp(),
    })
  } else if (isEdit && oldData?.paymentMode === 'credit' && oldData?.customerId) {
    // Mode changed away from credit — reverse old credit
    const custRef = doc(db, 'customers', oldData.customerId!)
    batch.update(custRef, { outstanding: increment(-(oldData.totalAmount ?? 0)), updatedAt: serverTimestamp() })
  }

  // 4. Daily summary
  const summRef = doc(db, 'dailySummaries', date)
  const oldSales = isEdit ? (oldData?.totalAmount ?? 0) : 0
  const oldCost  = isEdit ? (oldData?.totalCost ?? 0) : 0
  batch.set(summRef, {
    totalSales:  increment(data.totalAmount - oldSales),
    totalBills:  isEdit ? increment(0) : increment(1),
    grossProfit: increment((data.totalAmount - data.totalCost) - (oldSales - oldCost)),
    [`${data.paymentMode}Sales`]: increment(data.totalAmount - oldSales),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  // 5. Audit log
  await writeAudit(batch, userId, userName, isEdit ? 'EDIT' : 'CREATE', 'Sales', saleRef.id, {
    amount: data.totalAmount, customer: data.customerName,
    ...(isEdit ? { before: oldData?.totalAmount, after: data.totalAmount } : {}),
  })

  await batch.commit()
  return saleRef.id
}

// ── Purchase Transaction ──────────────────────────────────────────────────────

export interface PurchasePayload {
  id?: string
  purchaseDate: string
  vendorName?: string
  vendorId?: string
  totalAmount: number
  paidAmount?: number
  items?: { productId: string; quantity: number; purchasePrice?: number }[]
  [key: string]: any
}

export async function savePurchaseTransaction(
  data: PurchasePayload,
  userId: string,
  userName: string,
  oldData?: PurchasePayload
): Promise<string> {
  const batch    = writeBatch(db)
  const isEdit   = !!data.id
  const purRef   = isEdit ? doc(db, 'purchases', data.id!) : doc(collection(db, 'purchases'))
  const date     = data.purchaseDate || todayStr()
  const outstanding = data.totalAmount - (data.paidAmount ?? 0)

  batch.set(purRef, {
    ...data, id: undefined,
    outstandingAmount: outstanding,
    version: increment(1),
    updatedAt: serverTimestamp(),
    ...(isEdit ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true })

  // Stock increment
  for (const item of data.items || []) {
    const pRef   = doc(db, 'products', item.productId)
    const oldQty = oldData?.items?.find(i => i.productId === item.productId)?.quantity ?? 0
    const delta  = isEdit ? (item.quantity - oldQty) : item.quantity
    batch.update(pRef, {
      currentStock: increment(delta),
      ...(item.purchasePrice ? { purchasePrice: item.purchasePrice } : {}),
      updatedAt: serverTimestamp(),
    })
  }

  // Vendor outstanding
  if (data.vendorId) {
    const vendRef  = doc(db, 'vendors', data.vendorId)
    const oldOuts  = isEdit ? ((oldData?.totalAmount ?? 0) - (oldData?.paidAmount ?? 0)) : 0
    batch.update(vendRef, {
      outstanding: increment(outstanding - oldOuts),
      updatedAt: serverTimestamp(),
    })
  }

  // Daily summary
  const summRef  = doc(db, 'dailySummaries', date)
  const oldPurch = isEdit ? (oldData?.totalAmount ?? 0) : 0
  batch.set(summRef, {
    totalPurchases: increment(data.totalAmount - oldPurch),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await writeAudit(batch, userId, userName, isEdit ? 'EDIT' : 'CREATE', 'Purchases', purRef.id, {
    amount: data.totalAmount, vendor: data.vendorName,
  })

  await batch.commit()
  return purRef.id
}

// ── Customer Payment Transaction ──────────────────────────────────────────────

export interface PaymentPayload {
  id?: string
  customerId: string
  customerName?: string
  amount: number
  paymentMode: 'cash' | 'upi' | 'card'
  paymentDate: string
  [key: string]: any
}

export async function saveCustomerPaymentTransaction(
  data: PaymentPayload,
  userId: string,
  userName: string,
  oldData?: PaymentPayload
): Promise<string> {
  const batch  = writeBatch(db)
  const isEdit = !!data.id
  const payRef = isEdit ? doc(db, 'customerPayments', data.id!) : doc(collection(db, 'customerPayments'))
  const date   = data.paymentDate || todayStr()

  batch.set(payRef, {
    ...data, id: undefined, version: increment(1),
    updatedAt: serverTimestamp(),
    ...(isEdit ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true })

  // Reduce customer outstanding
  const custRef = doc(db, 'customers', data.customerId)
  const oldAmt  = isEdit ? (oldData?.amount ?? 0) : 0
  batch.update(custRef, {
    outstanding: increment(-(data.amount - oldAmt)),
    updatedAt: serverTimestamp(),
  })

  // Cash book entry
  const cashRef = doc(collection(db, 'cashBook'))
  if (!isEdit) {
    batch.set(cashRef, {
      date, transactionType: 'Customer Payment', cashIn: data.amount,
      cashOut: 0, description: `Payment from ${data.customerName || 'Customer'}`,
      referenceId: payRef.id, createdAt: serverTimestamp(),
    })
    // Update cash balance setting
    const balRef = doc(db, 'settings', 'cashBalance')
    batch.set(balRef, { value: increment(data.amount) }, { merge: true })
  }

  // Daily summary
  const summRef = doc(db, 'dailySummaries', date)
  batch.set(summRef, {
    customerCollections: increment(data.amount - oldAmt),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await writeAudit(batch, userId, userName, isEdit ? 'EDIT' : 'CREATE', 'CustomerPayments', payRef.id, {
    amount: data.amount, customer: data.customerName,
  })

  await batch.commit()
  return payRef.id
}

// ── Vendor Payment Transaction ────────────────────────────────────────────────

export interface VendorPaymentPayload {
  id?: string
  vendorId: string
  vendorName?: string
  amount: number
  paymentMode: 'cash' | 'upi' | 'card'
  paymentDate: string
  [key: string]: any
}

export async function saveVendorPaymentTransaction(
  data: VendorPaymentPayload,
  userId: string,
  userName: string,
  oldData?: VendorPaymentPayload
): Promise<string> {
  const batch  = writeBatch(db)
  const isEdit = !!data.id
  const payRef = isEdit ? doc(db, 'vendorPayments', data.id!) : doc(collection(db, 'vendorPayments'))
  const date   = data.paymentDate || todayStr()

  batch.set(payRef, {
    ...data, id: undefined, version: increment(1),
    updatedAt: serverTimestamp(),
    ...(isEdit ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true })

  // Reduce vendor outstanding
  const vendRef = doc(db, 'vendors', data.vendorId)
  const oldAmt  = isEdit ? (oldData?.amount ?? 0) : 0
  batch.update(vendRef, {
    outstanding: increment(-(data.amount - oldAmt)),
    updatedAt: serverTimestamp(),
  })

  // Cash book
  if (!isEdit) {
    const cashRef = doc(collection(db, 'cashBook'))
    batch.set(cashRef, {
      date, transactionType: 'Vendor Payment', cashIn: 0, cashOut: data.amount,
      description: `Payment to ${data.vendorName || 'Vendor'}`,
      referenceId: payRef.id, createdAt: serverTimestamp(),
    })
    const balRef = doc(db, 'settings', 'cashBalance')
    batch.set(balRef, { value: increment(-data.amount) }, { merge: true })
  }

  // Daily summary
  const summRef = doc(db, 'dailySummaries', date)
  batch.set(summRef, {
    vendorPayments: increment(data.amount - oldAmt),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await writeAudit(batch, userId, userName, isEdit ? 'EDIT' : 'CREATE', 'VendorPayments', payRef.id, {
    amount: data.amount, vendor: data.vendorName,
  })

  await batch.commit()
  return payRef.id
}

// ── Expense Transaction ───────────────────────────────────────────────────────

export interface ExpensePayload {
  id?: string
  categoryName: string
  description?: string
  amount: number
  paymentMode?: string
  expenseDate: string
  [key: string]: any
}

export async function saveExpenseTransaction(
  data: ExpensePayload,
  userId: string,
  userName: string,
  oldData?: ExpensePayload
): Promise<string> {
  const batch  = writeBatch(db)
  const isEdit = !!data.id
  const expRef = isEdit ? doc(db, 'expenses', data.id!) : doc(collection(db, 'expenses'))
  const date   = data.expenseDate || todayStr()

  batch.set(expRef, {
    ...data, id: undefined, version: increment(1),
    updatedAt: serverTimestamp(),
    ...(isEdit ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true })

  // Cash balance
  const oldAmt = isEdit ? (oldData?.amount ?? 0) : 0
  const balRef = doc(db, 'settings', 'cashBalance')
  batch.set(balRef, { value: increment(-(data.amount - oldAmt)) }, { merge: true })

  // Daily summary
  const summRef = doc(db, 'dailySummaries', date)
  batch.set(summRef, {
    totalExpenses: increment(data.amount - oldAmt),
    grossProfit:   increment(-(data.amount - oldAmt)),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await writeAudit(batch, userId, userName, isEdit ? 'EDIT' : 'CREATE', 'Expenses', expRef.id, {
    amount: data.amount, category: data.categoryName,
    ...(isEdit ? { before: oldData?.amount, after: data.amount } : {}),
  })

  await batch.commit()
  return expRef.id
}

// ── Generic Delete ────────────────────────────────────────────────────────────

export async function deleteWithAudit(
  col: string,
  id: string,
  userId: string,
  userName: string,
  module: string,
  details?: Record<string, any>
): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, col, id))
  await writeAudit(batch, userId, userName, 'DELETE', module, id, details)
  await batch.commit()
}

// ── Conflict-Safe Edit ────────────────────────────────────────────────────────
// Use runTransaction for conflict detection — checks version before writing.

export async function editWithConflictCheck(
  col: string,
  id: string,
  expectedVersion: number,
  newData: Record<string, any>,
  userId: string,
  userName: string,
  module: string
): Promise<void> {
  await runTransaction(db, async (txn) => {
    const ref     = doc(db, col, id)
    const current = await txn.get(ref)
    if (!current.exists()) throw new Error('Record not found')

    const currentVersion = current.data().version ?? 0
    if (currentVersion !== expectedVersion) {
      throw new Error('CONFLICT')
    }
    txn.update(ref, { ...newData, version: currentVersion + 1, updatedAt: serverTimestamp() })

    // Audit (separate doc — not inside same transaction due to Firestore limits)
  })
  // Write audit after transaction succeeds
  await addDoc(collection(db, 'auditLogs'), {
    userId, userName, action: 'EDIT', module, recordId: id,
    details: newData, createdAt: serverTimestamp(),
  })
}
