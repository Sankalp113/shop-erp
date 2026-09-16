import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  Timestamp, runTransaction, writeBatch, increment, getCountFromServer,
  QueryConstraint, DocumentData,
} from 'firebase/firestore'
import { db } from './config'

// ── Generic helpers ──────────────────────────────────────────────

export function toDate(ts: any): string {
  if (!ts) return ''
  if (ts instanceof Timestamp) return ts.toDate().toISOString().split('T')[0]
  if (typeof ts === 'string') return ts
  return ''
}

export async function getCollection<T>(col: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const q = query(collection(db, col), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)
}

export async function getDocument<T>(col: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, col, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

export async function createDocument(col: string, data: DocumentData): Promise<string> {
  const ref = await addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateDocument(col: string, id: string, data: Partial<DocumentData>): Promise<void> {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteDocument(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id))
}

// ── Settings ─────────────────────────────────────────────────────

export async function getSettings(): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, 'settings'))
  const result: Record<string, string> = {}
  snap.docs.forEach(d => { result[d.id] = d.data().value })
  return result
}

export async function setSetting(key: string, value: string): Promise<void> {
  await updateDoc(doc(db, 'settings', key), { value, updatedAt: serverTimestamp() })
    .catch(() => addDoc(collection(db, 'settings'), { key, value }))
}

// ── Products ─────────────────────────────────────────────────────

export async function getProducts(activeOnly = true) {
  const constraints: QueryConstraint[] = [orderBy('name')]
  if (activeOnly) constraints.unshift(where('isActive', '==', true))
  return getCollection('products', ...constraints)
}

export async function searchProducts(term: string) {
  // Client-side search (Firestore doesn't support full-text)
  const products = await getProducts()
  const t = term.toLowerCase()
  return products.filter((p: any) =>
    p.name?.toLowerCase().includes(t) ||
    p.code?.toLowerCase().includes(t) ||
    p.sku?.toLowerCase().includes(t)
  )
}

export async function getVariants(productId: string) {
  return getCollection(`products/${productId}/variants`)
}

// ── Stock ─────────────────────────────────────────────────────────

export async function getLowStockProducts() {
  const products = await getCollection<any>('products', where('isActive', '==', true))
  const variants = await Promise.all(
    products.map(async (p: any) => {
      if (p.hasVariants) {
        const vars = await getCollection<any>(`products/${p.id}/variants`)
        return vars.filter(v => v.currentStock <= (p.minStock || 5))
      }
      return []
    })
  )
  return { products: products.filter((p: any) => !p.hasVariants && (p.currentStock ?? 0) <= (p.minStock || 5)), variants: variants.flat() }
}

// ── Dashboard Summary ─────────────────────────────────────────────

export async function getDashboardSummary(date: string) {
  const snap = await getDoc(doc(db, 'dailySummaries', date))
  if (snap.exists()) return snap.data()

  // Real-time calculation fallback
  const todayStart = new Date(date); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(date); todayEnd.setHours(23, 59, 59, 999)

  const [sales, purchases, expenses] = await Promise.all([
    getDocs(query(collection(db, 'sales'), where('saleDate', '==', date), where('status', '==', 'completed'))),
    getDocs(query(collection(db, 'purchases'), where('purchaseDate', '==', date))),
    getDocs(query(collection(db, 'expenses'), where('expenseDate', '==', date))),
  ])

  let totalSales = 0, cashSales = 0, upiSales = 0, cardSales = 0, creditSales = 0, totalCost = 0
  sales.docs.forEach(d => {
    const s = d.data()
    totalSales += s.totalAmount || 0
    cashSales += s.cashAmount || 0
    upiSales += s.upiAmount || 0
    cardSales += s.cardAmount || 0
    creditSales += s.creditAmount || 0
    totalCost += s.totalCost || 0
  })

  const totalPurchases = purchases.docs.reduce((s, d) => s + (d.data().totalAmount || 0), 0)
  const totalExpenses = expenses.docs.reduce((s, d) => s + (d.data().amount || 0), 0)

  return {
    totalSales, totalBills: sales.size,
    cashSales, upiSales, cardSales, creditSales,
    totalPurchases, totalExpenses,
    grossProfit: totalSales - totalCost,
    date,
  }
}

export async function getOutstandingTotals() {
  const [customers, vendors] = await Promise.all([
    getDocs(query(collection(db, 'customers'), where('outstanding', '>', 0))),
    getDocs(query(collection(db, 'vendors'), where('outstanding', '>', 0))),
  ])
  return {
    customerOutstanding: customers.docs.reduce((s, d) => s + (d.data().outstanding || 0), 0),
    vendorOutstanding: vendors.docs.reduce((s, d) => s + (d.data().outstanding || 0), 0),
  }
}

export async function getCashBalance(): Promise<number> {
  const snap = await getDoc(doc(db, 'settings', 'cashBalance'))
  return snap.exists() ? (Number(snap.data().value) || 0) : 0
}

// ── Reminders ─────────────────────────────────────────────────────

export async function getPendingReminders() {
  return getCollection('reminders',
    where('status', 'in', ['upcoming', 'due_soon', 'due_today', 'overdue']),
    orderBy('dueDate'),
    limit(20)
  )
}

// ── Real-time listeners ─────────────────────────────────────────

export function onSalesChange(date: string, cb: (data: any[]) => void) {
  const q = query(collection(db, 'sales'), where('saleDate', '==', date), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

// ── Audit Log ─────────────────────────────────────────────────────

export async function writeAuditLog(userId: string, userName: string, action: string, module: string, recordId?: string, details?: any) {
  await addDoc(collection(db, 'auditLogs'), {
    userId, userName, action, module,
    recordId: recordId ?? null,
    details: details ?? null,
    createdAt: serverTimestamp(),
  })
}
