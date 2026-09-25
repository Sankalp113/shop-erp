/**
 * db.js — Firestore service layer (replaces Express backend)
 * All data is stored in Firebase Firestore, accessible from any device 24x7.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, runTransaction, writeBatch,
  serverTimestamp, Timestamp, increment, getCountFromServer
} from 'firebase/firestore'
import {
  signInWithEmailAndPassword, signOut as fbSignOut,
  createUserWithEmailAndPassword, onAuthStateChanged as fbOnAuthChanged,
  deleteUser as fbDeleteUser, updatePassword
} from 'firebase/auth'
import { db as firestore, auth } from '../firebase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toData = (snap) => snap.exists() ? { id: snap.id, ...snap.data() } : null
const toDocs = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }))
const today = () => new Date().toISOString().split('T')[0]
const now = () => new Date().toISOString()
const usernameToEmail = (u) => `${u.toLowerCase().trim()}@jkb.in`

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function signIn(usernameOrEmail, password) {
  // Accept both plain username (admin) OR full email (sankalpbhatiya@gmail.com)
  const email = usernameOrEmail.includes('@') ? usernameOrEmail : usernameToEmail(usernameOrEmail)
  const cred = await signInWithEmailAndPassword(auth, email, password)
  // Load user profile from Firestore
  const profileSnap = await getDoc(doc(firestore, 'users', cred.user.uid))
  if (!profileSnap.exists()) {
    // Auto-create owner profile for first-time real-email users
    const profile = { username: usernameOrEmail.split('@')[0].toLowerCase(), full_name: usernameOrEmail.split('@')[0], email: usernameOrEmail.includes('@') ? usernameOrEmail : '', mobile: '', role: 'owner', is_active: true, created_at: now() }
    await setDoc(doc(firestore, 'users', cred.user.uid), profile)
    return { uid: cred.user.uid, ...profile }
  }
  const profile = profileSnap.data()
  if (!profile.is_active) throw new Error('Account is deactivated')
  return { uid: cred.user.uid, ...profile }
}

export async function signOut() {
  await fbSignOut(auth)
}

export function onAuthChange(callback) {
  return fbOnAuthChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) { callback(null); return }
    const userRef = doc(firestore, 'users', firebaseUser.uid)
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      callback({ uid: firebaseUser.uid, ...snap.data() })
    } else {
      // Auto-create Firestore profile for real-email users (e.g. sankalpbhatiya@gmail.com)
      const email = firebaseUser.email || ''
      const username = email.split('@')[0].toLowerCase()
      const profile = { username, full_name: username, email, mobile: '', role: 'owner', is_active: true, created_at: now() }
      await setDoc(userRef, profile)
      callback({ uid: firebaseUser.uid, ...profile })
    }
  })
}

// ─── SEED & INIT ─────────────────────────────────────────────────────────────

export async function initializeShop() {
  const settingsSnap = await getDoc(doc(firestore, 'meta', 'settings'))
  if (settingsSnap.exists()) return // already initialized

  const batch = writeBatch(firestore)

  // Settings
  batch.set(doc(firestore, 'meta', 'settings'), {
    shop_name: 'Janta Kapad Bhandar',
    shop_address: '', shop_mobile: '', shop_email: '', shop_gstin: '',
    currency_symbol: '₹', invoice_prefix: 'INV', purchase_prefix: 'PUR',
    financial_year_start: '04', low_stock_alert_days: '7',
    created_at: now()
  })

  // Counters
  batch.set(doc(firestore, 'meta', 'counters'), {
    invoice: 0, purchase: 0, customer: 0, vendor: 0,
    product: 0, employee: 0, return_sale: 0, created_at: now()
  })

  // Default categories
  const cats = ['Shirts','T-Shirts','Jeans','Trousers','Salwar Kameez','Sarees','Kurtas','Leggings','Tops','Jackets','Kids Wear','Innerwear','Accessories']
  for (const name of cats) batch.set(doc(collection(firestore, 'categories')), { name, is_active: true, created_at: now() })

  // Default sizes
  const sizes = ['XS','S','M','L','XL','XXL','XXXL','28','30','32','34','36','38','40','42']
  sizes.forEach((name, i) => batch.set(doc(collection(firestore, 'sizes')), { name, sort_order: i, is_active: true }))

  // Default colors
  const colors = [
    {name:'White',hex_code:'#FFFFFF'},{name:'Black',hex_code:'#000000'},{name:'Red',hex_code:'#FF0000'},
    {name:'Blue',hex_code:'#0000FF'},{name:'Green',hex_code:'#008000'},{name:'Yellow',hex_code:'#FFFF00'},
    {name:'Pink',hex_code:'#FFC0CB'},{name:'Orange',hex_code:'#FFA500'},{name:'Purple',hex_code:'#800080'},
    {name:'Grey',hex_code:'#808080'},{name:'Brown',hex_code:'#A52A2A'},{name:'Navy',hex_code:'#000080'},
  ]
  for (const c of colors) batch.set(doc(collection(firestore, 'colors')), { ...c, is_active: true })

  // Default expense categories
  const expCats = ['Transportation','Packaging','Tea & Refreshments','Cleaning','Repairs & Maintenance','Internet','Telephone','Advertising','Marketing','Courier','Stationery','Bank Charges','Travel','Security','Other']
  for (const name of expCats) batch.set(doc(collection(firestore, 'expenseCategories')), { name, is_active: true })

  // Default bank account
  batch.set(doc(collection(firestore, 'bankAccounts')), {
    account_name: 'Main Account', bank_name: 'State Bank',
    account_number: '', ifsc_code: '', opening_balance: 0, current_balance: 0,
    is_active: true, created_at: now()
  })

  await batch.commit()
}

// ─── COUNTERS ────────────────────────────────────────────────────────────────

async function getNextCounter(field) {
  const ref = doc(firestore, 'meta', 'counters')
  let next
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.data()?.[field] || 0
    next = current + 1
    tx.update(ref, { [field]: next })
  })
  return next
}

async function getNextInvoiceNumber() {
  const settings = await getSettings()
  const prefix = settings.invoice_prefix || 'INV'
  const n = await getNextCounter('invoice')
  return `${prefix}-${String(n).padStart(5, '0')}`
}

async function getNextPurchaseNumber() {
  const settings = await getSettings()
  const prefix = settings.purchase_prefix || 'PUR'
  const n = await getNextCounter('purchase')
  return `${prefix}-${String(n).padStart(5, '0')}`
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export async function getSettings() {
  const snap = await getDoc(doc(firestore, 'meta', 'settings'))
  return snap.exists() ? snap.data() : {}
}

export async function updateSettings(data) {
  await setDoc(doc(firestore, 'meta', 'settings'), { ...data, updated_at: now() }, { merge: true })
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

export async function getProducts({ search = '', category_id = '', category_ids = null, is_active = true, limit: lim = 100 } = {}) {
  let q = query(collection(firestore, 'products'), where('is_active', '==', is_active !== false && is_active !== '0'))
  const snap = await getDocs(q)
  let data = toDocs(snap)
  if (search) { const s = search.toLowerCase(); data = data.filter(p => p.name?.toLowerCase().includes(s) || p.product_code?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)) }
  // category_ids array takes priority (used when filtering by parent to include all subcategories)
  if (category_ids && category_ids.length > 0) {
    data = data.filter(p => category_ids.includes(p.category_id))
  } else if (category_id) {
    data = data.filter(p => p.category_id === category_id)
  }
  data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return { data: data.slice(0, lim), total: data.length }
}

export async function getProduct(id) {
  const snap = await getDoc(doc(firestore, 'products', id))
  return toData(snap)
}

export async function createProduct(data) {
  const n = await getNextCounter('product')
  const product_code = `PRD${String(n).padStart(5, '0')}`
  const ref = await addDoc(collection(firestore, 'products'), {
    product_code, ...data,
    is_active: true, total_stock: data.opening_stock || 0,
    created_at: now(), updated_at: now()
  })
  if (data.opening_stock > 0) {
    await addDoc(collection(firestore, 'stockTransactions'), {
      product_id: ref.id, product_name: data.name,
      transaction_type: 'opening', quantity_change: data.opening_stock,
      quantity_before: 0, quantity_after: data.opening_stock,
      notes: 'Opening stock', created_at: now()
    })
  }
  return { id: ref.id, product_code }
}

export async function updateProduct(id, data) {
  await updateDoc(doc(firestore, 'products', id), { ...data, updated_at: now() })
}

export async function deleteProduct(id) {
  await updateDoc(doc(firestore, 'products', id), { is_active: false, updated_at: now() })
}

export async function getCategories() {
  const snap = await getDocs(query(collection(firestore, 'categories'), where('is_active', '==', true), orderBy('name')))
  return toDocs(snap)
}

// Returns { parents: [...], children: { parentId: [...] }, allIds: Set }
export async function getCategoriesTree() {
  const all = await getCategories()
  const parents = all.filter(c => !c.parent_id)
  const children = {}
  all.filter(c => c.parent_id).forEach(c => {
    if (!children[c.parent_id]) children[c.parent_id] = []
    children[c.parent_id].push(c)
  })
  return { parents, children, all }
}

export async function createCategory({ name, parent_id, description }) {
  const ref = await addDoc(collection(firestore, 'categories'), {
    name: name.trim(), parent_id: parent_id || null,
    description: description || '', is_active: true, created_at: now()
  })
  return { id: ref.id, name }
}

export async function updateCategory(id, { name, description }) {
  await updateDoc(doc(firestore, 'categories', id), {
    name: name.trim(), description: description || '', updated_at: now()
  })
}

export async function deleteCategory(id) {
  // Soft delete — also deactivate all children
  const batch = writeBatch(firestore)
  batch.update(doc(firestore, 'categories', id), { is_active: false, updated_at: now() })
  const childSnap = await getDocs(query(collection(firestore, 'categories'), where('parent_id', '==', id)))
  childSnap.docs.forEach(d => batch.update(d.ref, { is_active: false, updated_at: now() }))
  await batch.commit()
}

export async function getBrands() {
  const snap = await getDocs(query(collection(firestore, 'brands'), where('is_active', '==', true), orderBy('name')))
  return toDocs(snap)
}

export async function getSizes() {
  const snap = await getDocs(query(collection(firestore, 'sizes'), where('is_active', '==', true), orderBy('sort_order')))
  return toDocs(snap)
}

export async function getColors() {
  const snap = await getDocs(query(collection(firestore, 'colors'), where('is_active', '==', true), orderBy('name')))
  return toDocs(snap)
}


export async function createBrand({ name, description }) {
  const ref = await addDoc(collection(firestore, 'brands'), { name, description: description || '', is_active: true, created_at: now() })
  return { id: ref.id, name }
}

export async function getFabrics() {
  const snap = await getDocs(query(collection(firestore, 'fabrics'), where('is_active', '==', true)))
  return toDocs(snap)
}

// ─── STOCK ───────────────────────────────────────────────────────────────────

export async function getStock({ search = '', category_id = '', category_ids = null, low_stock = false } = {}) {
  const { data } = await getProducts({ search, category_id, category_ids, is_active: true, limit: 500 })
  let filtered = data
  if (low_stock) filtered = filtered.filter(p => (p.total_stock || 0) <= (p.min_stock_level || 5))
  return { data: filtered, total: filtered.length }
}

async function updateProductStockInTx(tx, productId, change) {
  const ref = doc(firestore, 'products', productId)
  const snap = await tx.get(ref)
  const current = snap.data()?.total_stock || 0
  const newQty = Math.max(0, current + change)
  tx.update(ref, { total_stock: newQty, updated_at: now() })
  return { before: current, after: newQty }
}

async function logStockTx(productId, productName, txType, refType, refId, change, before, after, notes, userId) {
  await addDoc(collection(firestore, 'stockTransactions'), {
    product_id: productId, product_name: productName || '',
    transaction_type: txType, reference_type: refType || null, reference_id: refId || null,
    quantity_change: change, quantity_before: before, quantity_after: after,
    notes: notes || '', created_by: userId || null, created_at: now()
  })
}

export async function createStockAdjustment({ product_id, variant_id, adjustment_type, quantity_change, reason, notes, product_name, adjustment_date }, userId) {
  let before, after
  const adjDate = adjustment_date || today()
  await runTransaction(firestore, async (tx) => {
    const res = await updateProductStockInTx(tx, product_id, Number(quantity_change))
    before = res.before; after = res.after
    await addDoc(collection(firestore, 'stockAdjustments'), {
      product_id, product_name: product_name || '', variant_id: variant_id || null,
      adjustment_type, quantity_change: Number(quantity_change),
      quantity_before: before, quantity_after: after,
      adjustment_date: adjDate,
      reason, notes: notes || '', created_by: userId || null, created_at: now()
    })
  })
  await logStockTx(product_id, product_name, 'adjustment', 'adjustment', null, Number(quantity_change), before, after, `${adjustment_type}: ${reason}`, userId)
  return { quantity_before: before, quantity_after: after }
}

export async function getStockAdjustments({ from, to } = {}) {
  let snap = await getDocs(query(collection(firestore, 'stockAdjustments'), orderBy('created_at', 'desc'), limit(200)))
  let data = toDocs(snap)
  if (from) data = data.filter(a => a.created_at >= from)
  if (to) data = data.filter(a => a.created_at <= to + 'T23:59:59')
  return { data, total: data.length }
}

export async function getStockTransactions({ product_id, from, to } = {}) {
  let snap = await getDocs(query(collection(firestore, 'stockTransactions'), orderBy('created_at', 'desc'), limit(300)))
  let data = toDocs(snap)
  if (product_id) data = data.filter(t => t.product_id === product_id)
  if (from) data = data.filter(t => t.created_at >= from)
  if (to) data = data.filter(t => t.created_at <= to + 'T23:59:59')
  return { data, total: data.length }
}

export async function getLowStock() {
  const { data } = await getProducts({ is_active: true, limit: 500 })
  return data.filter(p => (p.total_stock || 0) <= (p.min_stock_level || 5))
}

export async function getStockAging() {
  const { data: products } = await getProducts({ is_active: true, limit: 500 })
  const salesSnap = await getDocs(query(collection(firestore, 'saleItems'), orderBy('created_at', 'desc')))
  const saleItems = toDocs(salesSnap)
  const lastSaleMap = {}
  saleItems.forEach(si => {
    if (!lastSaleMap[si.product_id]) lastSaleMap[si.product_id] = si.sale_date || si.created_at
  })
  const withAging = products
    .filter(p => (p.total_stock || 0) > 0)
    .map(p => {
      const lastSold = lastSaleMap[p.id] || p.created_at || ''
      const ageDays = lastSold ? Math.floor((Date.now() - new Date(lastSold).getTime()) / 86400000) : 999
      return { ...p, last_sold_date: lastSold, age_days: ageDays, stock: p.total_stock || 0 }
    })
    .sort((a, b) => b.age_days - a.age_days)

  const categorized = {
    '0_30': withAging.filter(p => p.age_days <= 30),
    '31_60': withAging.filter(p => p.age_days > 30 && p.age_days <= 60),
    '61_90': withAging.filter(p => p.age_days > 60 && p.age_days <= 90),
    '91_180': withAging.filter(p => p.age_days > 90 && p.age_days <= 180),
    '180_plus': withAging.filter(p => p.age_days > 180),
  }
  return { data: withAging, categorized }
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

export async function getCustomers({ search = '', is_active = true, limit: lim = 100 } = {}) {
  const snap = await getDocs(query(collection(firestore, 'customers'), where('is_active', '==', is_active !== false && is_active !== '0')))
  let data = toDocs(snap)
  if (search) { const s = search.toLowerCase(); data = data.filter(c => c.name?.toLowerCase().includes(s) || c.mobile?.includes(s)) }
  data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return { data: data.slice(0, lim), total: data.length }
}

export async function getCustomer(id) {
  const snap = await getDoc(doc(firestore, 'customers', id))
  if (!snap.exists()) throw new Error('Customer not found')
  const customer = { id: snap.id, ...snap.data() }
  const ledger = await getDocs(query(collection(firestore, 'customerLedger'), where('customer_id', '==', id), orderBy('created_at', 'desc'), limit(50)))
  const sales = await getDocs(query(collection(firestore, 'sales'), where('customer_id', '==', id), where('status', '==', 'completed'), orderBy('created_at', 'desc'), limit(20)))
  const salesData = toDocs(sales)
  const totalPurchased = salesData.reduce((s, sale) => s + (sale.total_amount || 0), 0)
  const outstanding = salesData.reduce((s, sale) => s + ((sale.credit_amount || 0) - (sale.paid_amount || 0)), 0)
  return { ...customer, ledger: toDocs(ledger), recent_sales: salesData, stats: { total_purchased: totalPurchased, outstanding: Math.max(0, outstanding) } }
}

export async function createCustomer(data) {
  const n = await getNextCounter('customer')
  const customer_code = `CUS${String(n).padStart(5, '0')}`
  const ref = await addDoc(collection(firestore, 'customers'), {
    customer_code, ...data, is_active: true, created_at: now(), updated_at: now()
  })
  if (data.opening_balance > 0) {
    await addDoc(collection(firestore, 'customerLedger'), {
      customer_id: ref.id, customer_name: data.name,
      transaction_type: 'opening', debit: data.opening_balance, credit: 0,
      balance: data.opening_balance, notes: 'Opening balance',
      transaction_date: today(), created_at: now()
    })
  }
  return { id: ref.id, customer_code }
}

export async function updateCustomer(id, data) {
  await updateDoc(doc(firestore, 'customers', id), { ...data, updated_at: now() })
}

export async function recordCustomerPayment(customerId, { amount, payment_mode, payment_date, notes }, userId) {
  const customer = await getDoc(doc(firestore, 'customers', customerId))
  if (!customer.exists()) throw new Error('Customer not found')
  const customerData = customer.data()

  const ledgerSnap = await getDocs(query(collection(firestore, 'customerLedger'), where('customer_id', '==', customerId), orderBy('created_at', 'desc'), limit(1)))
  const lastBalance = ledgerSnap.docs[0]?.data()?.balance || 0
  const newBalance = lastBalance - Number(amount)

  await addDoc(collection(firestore, 'customerLedger'), {
    customer_id: customerId, customer_name: customerData.name,
    transaction_type: 'payment', debit: 0, credit: Number(amount),
    balance: newBalance, notes: notes || 'Payment received',
    transaction_date: payment_date || today(), created_at: now(), created_by: userId || null
  })

  if (payment_mode === 'cash') await addCashInflow(Number(amount), `Payment from ${customerData.name}`, 'customer_payment', null, payment_date || today(), userId)
}

export async function getCustomerOutstanding() {
  const snap = await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed')))
  const salesData = toDocs(snap).filter(s => (s.credit_amount || 0) > (s.paid_amount || 0))
  const byCustomer = {}
  salesData.forEach(s => {
    if (!s.customer_id) return
    if (!byCustomer[s.customer_id]) byCustomer[s.customer_id] = { id: s.customer_id, name: s.customer_name || '', mobile: s.customer_mobile || '', outstanding: 0, last_sale_date: '' }
    byCustomer[s.customer_id].outstanding += (s.credit_amount || 0) - (s.paid_amount || 0)
    if (s.created_at > byCustomer[s.customer_id].last_sale_date) byCustomer[s.customer_id].last_sale_date = s.created_at
  })
  return Object.values(byCustomer).filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)
}

// ─── VENDORS ─────────────────────────────────────────────────────────────────

export async function getVendors({ search = '', is_active = true, limit: lim = 100 } = {}) {
  const snap = await getDocs(query(collection(firestore, 'vendors'), where('is_active', '==', is_active !== false)))
  let data = toDocs(snap)
  if (search) { const s = search.toLowerCase(); data = data.filter(v => v.name?.toLowerCase().includes(s) || v.mobile?.includes(s) || v.company_name?.toLowerCase().includes(s)) }
  data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return { data: data.slice(0, lim), total: data.length }
}

export async function getVendor(id) {
  const snap = await getDoc(doc(firestore, 'vendors', id))
  if (!snap.exists()) throw new Error('Vendor not found')
  const vendor = { id: snap.id, ...snap.data() }
  const ledger = await getDocs(query(collection(firestore, 'vendorLedger'), where('vendor_id', '==', id), orderBy('created_at', 'desc'), limit(50)))
  const purchases = await getDocs(query(collection(firestore, 'purchases'), where('vendor_id', '==', id), orderBy('created_at', 'desc'), limit(20)))
  return { ...vendor, ledger: toDocs(ledger), recent_purchases: toDocs(purchases) }
}

export async function createVendor(data) {
  const n = await getNextCounter('vendor')
  const vendor_code = `VEN${String(n).padStart(5, '0')}`
  const ref = await addDoc(collection(firestore, 'vendors'), { vendor_code, ...data, is_active: true, created_at: now(), updated_at: now() })
  return { id: ref.id, vendor_code }
}

export async function updateVendor(id, data) {
  await updateDoc(doc(firestore, 'vendors', id), { ...data, updated_at: now() })
}

export async function recordVendorPayment(vendorId, { amount, payment_mode, payment_date, reference_number, notes }, userId) {
  const vendor = await getDoc(doc(firestore, 'vendors', vendorId))
  if (!vendor.exists()) throw new Error('Vendor not found')
  const vendorData = vendor.data()

  const ledgerSnap = await getDocs(query(collection(firestore, 'vendorLedger'), where('vendor_id', '==', vendorId), orderBy('created_at', 'desc'), limit(1)))
  const lastBalance = ledgerSnap.docs[0]?.data()?.balance || 0
  const newBalance = lastBalance - Number(amount)

  await addDoc(collection(firestore, 'vendorLedger'), {
    vendor_id: vendorId, vendor_name: vendorData.name,
    transaction_type: 'payment', debit: Number(amount), credit: 0,
    balance: newBalance, notes: notes || 'Payment to vendor',
    transaction_date: payment_date || today(), created_at: now(), created_by: userId || null
  })

  // Update outstanding on pending purchases (FIFO)
  const pendingPurchases = await getDocs(query(collection(firestore, 'purchases'), where('vendor_id', '==', vendorId), where('outstanding_amount', '>', 0)))
  let remaining = Number(amount)
  for (const pDoc of pendingPurchases.docs) {
    if (remaining <= 0) break
    const p = pDoc.data()
    const toApply = Math.min(remaining, p.outstanding_amount)
    const newOutstanding = p.outstanding_amount - toApply
    await updateDoc(pDoc.ref, { paid_amount: (p.paid_amount || 0) + toApply, outstanding_amount: newOutstanding, status: newOutstanding <= 0 ? 'paid' : 'partial' })
    remaining -= toApply
  }

  if (payment_mode === 'cash') await addCashOutflow(Number(amount), `Payment to ${vendorData.name}`, 'vendor_payment', null, payment_date || today(), userId)
}

// ─── SALES ───────────────────────────────────────────────────────────────────

export async function getSales({ from, to, customer_id, payment_mode, status, search, limit: lim = 50 } = {}) {
  let snap = await getDocs(query(collection(firestore, 'sales'), orderBy('created_at', 'desc'), limit(500)))
  let data = toDocs(snap).filter(s => s.status !== 'deleted')
  if (from) data = data.filter(s => (s.sale_date || s.created_at) >= from)
  if (to) data = data.filter(s => (s.sale_date || s.created_at) <= to + 'T23:59:59')
  if (customer_id) data = data.filter(s => s.customer_id === customer_id)
  if (payment_mode) data = data.filter(s => s.payment_mode === payment_mode)
  if (status) data = data.filter(s => s.status === status)
  if (search) { const sr = search.toLowerCase(); data = data.filter(s => s.invoice_number?.toLowerCase().includes(sr) || s.customer_name?.toLowerCase().includes(sr)) }
  const totals = { total_sales: data.reduce((s,x)=>s+(x.total_amount||0),0), cash: data.reduce((s,x)=>s+(x.cash_amount||0),0), upi: data.reduce((s,x)=>s+(x.upi_amount||0),0), card: data.reduce((s,x)=>s+(x.card_amount||0),0), credit: data.reduce((s,x)=>s+(x.credit_amount||0),0) }
  return { data: data.slice(0, lim), total: data.length, totals }
}

export async function getSale(id) {
  const snap = await getDoc(doc(firestore, 'sales', id))
  if (!snap.exists()) throw new Error('Sale not found')
  const saleData = { id: snap.id, ...snap.data() }
  const itemsSnap = await getDocs(query(collection(firestore, 'saleItems'), where('sale_id', '==', id)))
  saleData.items = toDocs(itemsSnap)
  return saleData
}

export async function createSale({ customer_id, customer_name, customer_mobile, items, discount_amount = 0, cash_amount = 0, upi_amount = 0, card_amount = 0, credit_amount = 0, payment_mode = 'cash', notes, sale_date }, userId, username) {
  if (!items || items.length === 0) throw new Error('No items in sale')

  const invoice_number = await getNextInvoiceNumber()
  const saleDate = sale_date || today()

  let subtotal = 0, item_discount_total = 0, tax_amount = 0
  const processedItems = items.map(item => {
    const gross = item.unit_price * item.quantity
    const itemDisc = gross * (item.discount_percent || 0) / 100
    const itemNet = gross - itemDisc
    const itemTax = itemNet * (item.tax_percent || 0) / 100
    const itemTotal = itemNet + itemTax
    subtotal += gross
    item_discount_total += itemDisc
    tax_amount += itemTax
    return { ...item, discount_amount: itemDisc, tax_amount: itemTax, total_price: itemTotal }
  })

  const total_amount = subtotal - item_discount_total - Number(discount_amount) + tax_amount
  const paid_amount = Number(cash_amount) + Number(upi_amount) + Number(card_amount)

  // Create sale
  const saleRef = await addDoc(collection(firestore, 'sales'), {
    invoice_number, sale_date: saleDate,
    customer_id: customer_id || null, customer_name: customer_name || 'Walk-in Customer',
    customer_mobile: customer_mobile || null,
    subtotal, item_discount_amount: item_discount_total, discount_amount: Number(discount_amount), tax_amount, total_amount,

    paid_amount, credit_amount: Number(credit_amount),
    payment_mode, cash_amount: Number(cash_amount), upi_amount: Number(upi_amount),
    card_amount: Number(card_amount), notes: notes || null,
    status: 'completed', created_by: userId || null, created_at: now()
  })

  // Create sale items & deduct stock
  for (const item of processedItems) {
    await addDoc(collection(firestore, 'saleItems'), {
      sale_id: saleRef.id, sale_date: saleDate, ...item, created_at: now()
    })
    // Deduct stock
    await runTransaction(firestore, async (tx) => {
      await updateProductStockInTx(tx, item.product_id, -item.quantity)
    })
    await logStockTx(item.product_id, item.product_name, 'sale', 'sale', saleRef.id, -item.quantity, 0, 0, `Sale ${invoice_number}`, userId)
  }

  // Customer ledger for credit
  if (customer_id && Number(credit_amount) > 0) {
    const ledgerSnap = await getDocs(query(collection(firestore, 'customerLedger'), where('customer_id', '==', customer_id), orderBy('created_at', 'desc'), limit(1)))
    const lastBal = ledgerSnap.docs[0]?.data()?.balance || 0
    await addDoc(collection(firestore, 'customerLedger'), {
      customer_id, customer_name: customer_name || '', transaction_type: 'sale',
      debit: Number(credit_amount), credit: 0, balance: lastBal + Number(credit_amount),
      notes: `Credit sale - ${invoice_number}`, transaction_date: saleDate, created_at: now(), created_by: userId || null
    })
  }

  // Cash transaction
  if (Number(cash_amount) > 0) await addCashInflow(Number(cash_amount), `Sale ${invoice_number}`, 'sale', saleRef.id, saleDate, userId)

  return { id: saleRef.id, invoice_number, total_amount }
}

export async function cancelSale(id, userId, username) {
  const sale = await getSale(id)
  if (sale.status === 'cancelled') throw new Error('Sale already cancelled')
  await updateDoc(doc(firestore, 'sales', id), { status: 'cancelled', updated_at: now() })
  for (const item of sale.items || []) {
    await runTransaction(firestore, async (tx) => { await updateProductStockInTx(tx, item.product_id, item.quantity) })
    await logStockTx(item.product_id, item.product_name, 'return', 'sale', id, item.quantity, 0, 0, `Sale cancelled - ${sale.invoice_number}`, userId)
  }
}

export async function getSaleReturns({ from, to } = {}) {
  let snap = await getDocs(query(collection(firestore, 'saleReturns'), orderBy('created_at', 'desc'), limit(200)))
  let data = toDocs(snap)
  if (from) data = data.filter(r => r.return_date >= from)
  if (to) data = data.filter(r => r.return_date <= to)
  return { data, total: data.length }
}

export async function createSaleReturn({ original_sale_id, return_reason, refund_mode, items, notes }, userId) {
  if (!items || items.length === 0) throw new Error('No items to return')
  const n = await getNextCounter('return_sale')
  const return_number = `RET-${String(n).padStart(5, '0')}`
  const return_date = today()
  const total_return_amount = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  const ref = await addDoc(collection(firestore, 'saleReturns'), {
    return_number, original_sale_id: original_sale_id || null, return_date,
    return_reason: return_reason || null, total_return_amount,
    refund_mode: refund_mode || 'cash', notes: notes || null,
    created_by: userId || null, created_at: now()
  })

  for (const item of items) {
    await runTransaction(firestore, async (tx) => { await updateProductStockInTx(tx, item.product_id, item.quantity) })
    await logStockTx(item.product_id, item.product_name, 'return', 'sale_return', ref.id, item.quantity, 0, 0, `Return ${return_number}`, userId)
  }
  return { id: ref.id, return_number, total_return_amount }
}

// ─── PURCHASES ───────────────────────────────────────────────────────────────

export async function getPurchases({ from, to, vendor_id, status, limit: lim = 50 } = {}) {
  let snap = await getDocs(query(collection(firestore, 'purchases'), orderBy('created_at', 'desc'), limit(300)))
  let data = toDocs(snap)
  if (from) data = data.filter(p => (p.purchase_date || p.created_at) >= from)
  if (to) data = data.filter(p => (p.purchase_date || p.created_at) <= to + 'T23:59:59')
  if (vendor_id) data = data.filter(p => p.vendor_id === vendor_id)
  if (status) data = data.filter(p => p.status === status)
  return { data: data.slice(0, lim), total: data.length }
}

export async function getPurchase(id) {
  const snap = await getDoc(doc(firestore, 'purchases', id))
  if (!snap.exists()) throw new Error('Purchase not found')
  const purchase = { id: snap.id, ...snap.data() }
  const itemsSnap = await getDocs(query(collection(firestore, 'purchaseItems'), where('purchase_id', '==', id)))
  const paymentsSnap = await getDocs(query(collection(firestore, 'purchasePayments'), where('purchase_id', '==', id)))
  purchase.items = toDocs(itemsSnap)
  purchase.payments = toDocs(paymentsSnap)
  return purchase
}

export async function createPurchase({ vendor_id, vendor_name, vendor_invoice_number, purchase_date, items, discount_amount = 0, paid_amount = 0, payment_mode, due_date, notes }, userId) {
  if (!items || items.length === 0) throw new Error('No items in purchase')
  const purchase_number = await getNextPurchaseNumber()
  const pDate = purchase_date || today()

  let subtotal = 0, item_discount_total = 0, tax_amount = 0
  const processedItems = items.map(item => {
    const gross = item.unit_price * item.quantity
    const itemDisc = gross * (item.discount_percent || 0) / 100
    const itemNet = gross - itemDisc
    const itemTax = itemNet * (item.tax_percent || 0) / 100
    subtotal += gross
    item_discount_total += itemDisc
    tax_amount += itemTax
    return { ...item, discount_amount: itemDisc, tax_amount: itemTax, total_price: itemNet + itemTax }
  })

  const total_amount = subtotal - item_discount_total - Number(discount_amount) + tax_amount
  const outstanding_amount = total_amount - Number(paid_amount)

  const purchaseRef = await addDoc(collection(firestore, 'purchases'), {
    purchase_number, vendor_invoice_number: vendor_invoice_number || null,
    purchase_date: pDate, vendor_id: vendor_id || null, vendor_name: vendor_name || '',
    subtotal, item_discount_amount: item_discount_total, discount_amount: Number(discount_amount), tax_amount, total_amount,

    paid_amount: Number(paid_amount), outstanding_amount,
    payment_mode: payment_mode || null, due_date: due_date || null, notes: notes || null,
    status: outstanding_amount <= 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending',
    created_by: userId || null, created_at: now()
  })

  for (const item of processedItems) {
    await addDoc(collection(firestore, 'purchaseItems'), { purchase_id: purchaseRef.id, ...item, created_at: now() })
    await runTransaction(firestore, async (tx) => { await updateProductStockInTx(tx, item.product_id, item.quantity) })
    await logStockTx(item.product_id, item.product_name, 'purchase', 'purchase', purchaseRef.id, item.quantity, 0, 0, `Purchase ${purchase_number}`, userId)
  }

  if (Number(paid_amount) > 0 && payment_mode === 'cash') {
    await addCashOutflow(Number(paid_amount), `Purchase ${purchase_number}`, 'purchase', purchaseRef.id, pDate, userId)
  }

  // Vendor ledger
  if (vendor_id) {
    const ledgerSnap = await getDocs(query(collection(firestore, 'vendorLedger'), where('vendor_id', '==', vendor_id), orderBy('created_at', 'desc'), limit(1)))
    const lastBal = ledgerSnap.docs[0]?.data()?.balance || 0
    await addDoc(collection(firestore, 'vendorLedger'), {
      vendor_id, vendor_name: vendor_name || '', transaction_type: 'purchase',
      debit: 0, credit: outstanding_amount, balance: lastBal + outstanding_amount,
      notes: `Purchase - ${purchase_number}`, transaction_date: pDate, created_at: now(), created_by: userId || null
    })
  }

  return { id: purchaseRef.id, purchase_number, total_amount }
}

export async function recordPurchasePayment(purchaseId, { amount, payment_mode, reference_number, payment_date, notes }, userId) {
  const purchaseSnap = await getDoc(doc(firestore, 'purchases', purchaseId))
  if (!purchaseSnap.exists()) throw new Error('Purchase not found')
  const purchase = purchaseSnap.data()
  const newPaid = (purchase.paid_amount || 0) + Number(amount)
  const newOutstanding = (purchase.outstanding_amount || 0) - Number(amount)
  await updateDoc(doc(firestore, 'purchases', purchaseId), { paid_amount: newPaid, outstanding_amount: Math.max(0, newOutstanding), status: newOutstanding <= 0 ? 'paid' : 'partial', updated_at: now() })
  await addDoc(collection(firestore, 'purchasePayments'), { purchase_id: purchaseId, payment_date: payment_date || today(), amount: Number(amount), payment_mode, reference_number: reference_number || null, notes: notes || null, created_by: userId || null, created_at: now() })
  if (payment_mode === 'cash') await addCashOutflow(Number(amount), `Payment for ${purchase.purchase_number}`, 'purchase_payment', purchaseId, payment_date || today(), userId)
}

export async function updatePurchase(id, { vendor_id, vendor_name, vendor_invoice_number, purchase_date, items, discount_amount = 0, paid_amount = 0, payment_mode, notes }, userId) {
  if (!items || items.length === 0) throw new Error('Purchase must have at least one item')

  // 1. Reverse stock for all existing items and delete them
  const existingItemsSnap = await getDocs(query(collection(firestore, 'purchaseItems'), where('purchase_id', '==', id)))
  for (const itemDoc of existingItemsSnap.docs) {
    const item = itemDoc.data()
    if (item.product_id) {
      await runTransaction(firestore, async (tx) => {
        await updateProductStockInTx(tx, item.product_id, -item.quantity) // reverse the addition
      })
    }
    await deleteDoc(itemDoc.ref)
  }

  // 2. Recalculate totals with new items
  let subtotal = 0, item_discount_total = 0, tax_amount = 0
  const processedItems = items.map(item => {
    const gross = item.unit_price * item.quantity
    const itemDisc = gross * (item.discount_percent || 0) / 100
    const itemNet = gross - itemDisc
    const itemTax = itemNet * (item.tax_percent || 0) / 100
    subtotal += gross
    item_discount_total += itemDisc
    tax_amount += itemTax
    return { ...item, discount_amount: itemDisc, tax_amount: itemTax, total_price: itemNet + itemTax }
  })

  const total_amount = subtotal - item_discount_total - Number(discount_amount) + tax_amount
  const outstanding_amount = total_amount - Number(paid_amount)

  // 3. Add new items and update stock
  for (const item of processedItems) {
    await addDoc(collection(firestore, 'purchaseItems'), { purchase_id: id, ...item, created_at: now() })
    if (item.product_id) {
      await runTransaction(firestore, async (tx) => { await updateProductStockInTx(tx, item.product_id, item.quantity) })
    }
  }

  // 4. Update purchase header
  await updateDoc(doc(firestore, 'purchases', id), {
    vendor_id: vendor_id || null, vendor_name: vendor_name || '',
    vendor_invoice_number: vendor_invoice_number || null,
    purchase_date: purchase_date || today(),
    subtotal, item_discount_amount: item_discount_total, discount_amount: Number(discount_amount), tax_amount, total_amount,

    paid_amount: Number(paid_amount), outstanding_amount: Math.max(0, outstanding_amount),
    payment_mode: payment_mode || null, notes: notes || null,
    status: outstanding_amount <= 0 ? 'paid' : Number(paid_amount) > 0 ? 'partial' : 'pending',
    updated_at: now(), updated_by: userId || null
  })
  return { id, total_amount }
}

// ─── STAFF ───────────────────────────────────────────────────────────────────

export async function getEmployees({ status = 'active', search = '' } = {}) {
  const snap = await getDocs(query(collection(firestore, 'employees'), where('status', '==', status)))
  let data = toDocs(snap)
  if (search) { const s = search.toLowerCase(); data = data.filter(e => e.name?.toLowerCase().includes(s) || e.mobile?.includes(s)) }
  data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return data
}

export async function createEmployee(data) {
  const n = await getNextCounter('employee')
  const employee_code = `EMP${String(n).padStart(5, '0')}`
  const ref = await addDoc(collection(firestore, 'employees'), { employee_code, ...data, status: 'active', created_at: now(), updated_at: now() })
  return { id: ref.id, employee_code }
}

export async function updateEmployee(id, data) {
  await updateDoc(doc(firestore, 'employees', id), { ...data, updated_at: now() })
}

export async function getAttendance({ employee_id, from, to, month } = {}) {
  let snap = await getDocs(query(collection(firestore, 'attendance'), orderBy('attendance_date', 'desc'), limit(500)))
  let data = toDocs(snap)
  if (employee_id) data = data.filter(a => a.employee_id === employee_id)
  if (month) data = data.filter(a => a.attendance_date?.startsWith(month))
  if (from) data = data.filter(a => a.attendance_date >= from)
  if (to) data = data.filter(a => a.attendance_date <= to)
  return data
}

export async function markAttendance(records, userId) {
  const batch = writeBatch(firestore)
  for (const rec of records) {
    const ref = doc(collection(firestore, 'attendance'))
    batch.set(ref, { ...rec, created_by: userId || null, created_at: now() })
  }
  await batch.commit()
}

export async function getSalaries({ month, employee_id } = {}) {
  let snap = await getDocs(query(collection(firestore, 'salaries'), orderBy('created_at', 'desc'), limit(200)))
  let data = toDocs(snap)
  if (month) data = data.filter(s => s.salary_month === month)
  if (employee_id) data = data.filter(s => s.employee_id === employee_id)
  return { data, total: data.length }
}

export async function generateSalary(data) {
  const ref = await addDoc(collection(firestore, 'salaries'), { ...data, status: 'pending', created_at: now() })
  return { id: ref.id }
}

export async function updateSalary(id, data) {
  await updateDoc(doc(firestore, 'salaries', id), { ...data, updated_at: now() })
  if (data.status === 'paid' && data.payment_mode === 'cash') {
    await addCashOutflow(data.paid_amount || data.net_salary, `Salary - ${data.employee_name}`, 'salary', id, data.payment_date || today(), null)
  }
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────

export async function getExpenseCategories() {
  const snap = await getDocs(query(collection(firestore, 'expenseCategories'), where('is_active', '==', true), orderBy('name')))
  return toDocs(snap)
}

export async function getExpenses({ from, to, category_id } = {}) {
  let snap = await getDocs(query(collection(firestore, 'expenses'), orderBy('created_at', 'desc'), limit(300)))
  let data = toDocs(snap)
  if (from) data = data.filter(e => e.expense_date >= from)
  if (to) data = data.filter(e => e.expense_date <= to)
  if (category_id) data = data.filter(e => e.category_id === category_id)
  const totals = { total: data.reduce((s, e) => s + (e.amount || 0), 0) }
  return { data, total: data.length, totals }
}

export async function createExpense({ expense_date, category_id, category_name, description, amount, payment_mode, vendor_person, notes }, userId) {
  const ref = await addDoc(collection(firestore, 'expenses'), { expense_date: expense_date || today(), category_id: category_id || null, category_name: category_name || '', description, amount: Number(amount), payment_mode, vendor_person: vendor_person || null, notes: notes || null, created_by: userId || null, created_at: now() })
  if (payment_mode === 'cash') await addCashOutflow(Number(amount), description, 'expense', ref.id, expense_date || today(), userId)
  return { id: ref.id }
}

export async function deleteExpense(id) { await deleteDoc(doc(firestore, 'expenses', id)) }
export async function updateExpense(id, data) { await updateDoc(doc(firestore, 'expenses', id), { ...data, amount: Number(data.amount), updated_at: now() }) }


// Electricity
export async function getElectricityBills() {
  const snap = await getDocs(query(collection(firestore, 'electricityBills'), orderBy('bill_date', 'desc')))
  return toDocs(snap)
}

export async function createElectricityBill(data) {
  const ref = await addDoc(collection(firestore, 'electricityBills'), { ...data, status: 'pending', created_at: now() })
  return { id: ref.id }
}

export async function payElectricityBill(id, { payment_mode, payment_date }, userId) {
  const snap = await getDoc(doc(firestore, 'electricityBills', id))
  const bill = snap.data()
  await updateDoc(doc(firestore, 'electricityBills', id), { status: 'paid', payment_date: payment_date || today(), payment_mode, updated_at: now() })
  if (payment_mode === 'cash') await addCashOutflow(bill.bill_amount, `Electricity Bill`, 'electricity', id, payment_date || today(), userId)
}

// Rent
export async function getRentPayments() {
  const snap = await getDocs(query(collection(firestore, 'rentPayments'), orderBy('period_start', 'desc')))
  return toDocs(snap)
}

export async function createRentPayment(data) {
  const ref = await addDoc(collection(firestore, 'rentPayments'), { ...data, status: 'pending', created_at: now() })
  return { id: ref.id }
}

export async function payRent(id, { payment_mode, payment_date }, userId) {
  const snap = await getDoc(doc(firestore, 'rentPayments', id))
  const rent = snap.data()
  await updateDoc(doc(firestore, 'rentPayments', id), { status: 'paid', payment_date: payment_date || today(), payment_mode, updated_at: now() })
  if (payment_mode === 'cash') await addCashOutflow(rent.amount, `Shop Rent`, 'rent', id, payment_date || today(), userId)
}

// Recurring
export async function getRecurringExpenses() {
  const snap = await getDocs(query(collection(firestore, 'recurringExpenses'), orderBy('name')))
  return toDocs(snap)
}

export async function createRecurringExpense(data) {
  const ref = await addDoc(collection(firestore, 'recurringExpenses'), { ...data, is_active: true, created_at: now() })
  return { id: ref.id }
}

export async function toggleRecurringExpense(id, is_active) {
  await updateDoc(doc(firestore, 'recurringExpenses', id), { is_active, updated_at: now() })
}

// ─── FINANCE / CASH ──────────────────────────────────────────────────────────

async function getLastCashBalance() {
  const snap = await getDocs(query(collection(firestore, 'cashTransactions'), orderBy('created_at', 'desc'), limit(1)))
  return snap.docs[0]?.data()?.balance_after || 0
}

async function addCashInflow(amount, description, refType, refId, txDate, userId) {
  const lastBal = await getLastCashBalance()
  const newBal = lastBal + amount
  await addDoc(collection(firestore, 'cashTransactions'), { transaction_date: txDate || today(), transaction_type: refType || 'other', reference_type: refType || null, reference_id: refId || null, description, amount, balance_after: newBal, is_inflow: true, created_by: userId || null, created_at: now() })
}

async function addCashOutflow(amount, description, refType, refId, txDate, userId) {
  const lastBal = await getLastCashBalance()
  const newBal = Math.max(0, lastBal - amount)
  await addDoc(collection(firestore, 'cashTransactions'), { transaction_date: txDate || today(), transaction_type: refType || 'other', reference_type: refType || null, reference_id: refId || null, description, amount: -amount, balance_after: newBal, is_inflow: false, created_by: userId || null, created_at: now() })
}

export async function getCashBook({ from, to } = {}) {
  let snap = await getDocs(query(collection(firestore, 'cashTransactions'), orderBy('created_at', 'desc'), limit(500)))
  let data = toDocs(snap)
  if (from) data = data.filter(t => t.transaction_date >= from)
  if (to) data = data.filter(t => t.transaction_date <= to)
  const balance = data.length > 0 ? (data[0].balance_after || 0) : 0
  return { data, total: data.length, current_balance: balance }
}

export async function addCashTransaction(txData, userId) {
  if (txData.transaction_type === 'deposit' || txData.is_inflow) {
    await addCashInflow(Number(txData.amount), txData.description, txData.transaction_type, null, txData.transaction_date, userId)
  } else {
    await addCashOutflow(Number(txData.amount), txData.description, txData.transaction_type, null, txData.transaction_date, userId)
  }
}

export async function getBankAccounts() {
  const snap = await getDocs(query(collection(firestore, 'bankAccounts'), where('is_active', '==', true)))
  return toDocs(snap)
}

export async function createBankAccount(data) {
  const ref = await addDoc(collection(firestore, 'bankAccounts'), { ...data, current_balance: data.opening_balance || 0, is_active: true, created_at: now() })
  return { id: ref.id }
}

export async function getBankTransactions(accountId, { from, to } = {}) {
  let snap = await getDocs(query(collection(firestore, 'bankTransactions'), where('account_id', '==', accountId), orderBy('created_at', 'desc'), limit(200)))
  let data = toDocs(snap)
  if (from) data = data.filter(t => t.transaction_date >= from)
  if (to) data = data.filter(t => t.transaction_date <= to)
  return { data, total: data.length }
}

export async function addBankTransaction({ account_id, account_name, transaction_date, transaction_type, description, amount, reference_number }, userId) {
  const accountSnap = await getDoc(doc(firestore, 'bankAccounts', account_id))
  if (!accountSnap.exists()) throw new Error('Account not found')
  const acct = accountSnap.data()
  const isInflow = ['deposit', 'upi_collection', 'card_collection'].includes(transaction_type)
  const newBalance = isInflow ? (acct.current_balance || 0) + Number(amount) : (acct.current_balance || 0) - Number(amount)
  await updateDoc(doc(firestore, 'bankAccounts', account_id), { current_balance: newBalance })
  await addDoc(collection(firestore, 'bankTransactions'), { account_id, account_name: account_name || acct.account_name, transaction_date: transaction_date || today(), transaction_type, description, amount: isInflow ? Number(amount) : -Number(amount), balance_after: newBalance, reference_number: reference_number || null, created_by: userId || null, created_at: now() })
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export async function getDashboardSummary() {
  const todayStr = today()
  const monthStart = todayStr.substring(0, 7) + '-01'

  const salesSnap = await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed')))
  const allSales = toDocs(salesSnap)
  const todaySales = allSales.filter(s => (s.sale_date || s.created_at?.split('T')[0]) === todayStr)
  const monthSales = allSales.filter(s => (s.sale_date || s.created_at?.split('T')[0]) >= monthStart)

  const purchasesSnap = await getDocs(query(collection(firestore, 'purchases')))
  const allPurchases = toDocs(purchasesSnap)
  const todayPurchases = allPurchases.filter(p => (p.purchase_date || p.created_at?.split('T')[0]) === todayStr)

  const expSnap = await getDocs(query(collection(firestore, 'expenses')))
  const allExp = toDocs(expSnap)
  const todayExp = allExp.filter(e => (e.expense_date || e.created_at?.split('T')[0]) === todayStr)

  const returnsSnap = await getDocs(query(collection(firestore, 'saleReturns')))
  const todayReturns = toDocs(returnsSnap).filter(r => r.return_date === todayStr)

  const custSnap = await getDocs(query(collection(firestore, 'customers')))
  const newCustomers = toDocs(custSnap).filter(c => c.created_at?.split('T')[0] === todayStr)

  // Sale items for gross profit
  const itemsSnap = await getDocs(query(collection(firestore, 'saleItems')))
  const allItems = toDocs(itemsSnap)
  const todayItems = allItems.filter(si => si.sale_date === todayStr)
  const grossProfit = todayItems.reduce((s, si) => s + ((si.unit_price * (1 - (si.discount_percent || 0)/100) - (si.purchase_price || 0)) * si.quantity), 0)

  const customerOutstanding = allSales.filter(s => (s.credit_amount || 0) > (s.paid_amount || 0)).reduce((s, x) => s + ((x.credit_amount || 0) - (x.paid_amount || 0)), 0)
  const vendorOutstanding = allPurchases.filter(p => (p.outstanding_amount || 0) > 0).reduce((s, p) => s + (p.outstanding_amount || 0), 0)
  const cashBal = await getLastCashBalance()

  return {
    today: {
      total_sales: todaySales.reduce((s, x) => s + (x.total_amount || 0), 0),
      total_bills: todaySales.length,
      cash_sales: todaySales.reduce((s, x) => s + (x.cash_amount || 0), 0),
      upi_sales: todaySales.reduce((s, x) => s + (x.upi_amount || 0), 0),
      card_sales: todaySales.reduce((s, x) => s + (x.card_amount || 0), 0),
      credit_sales: todaySales.reduce((s, x) => s + (x.credit_amount || 0), 0),
      purchases: todayPurchases.reduce((s, x) => s + (x.total_amount || 0), 0),
      expenses: todayExp.reduce((s, x) => s + (x.amount || 0), 0),
      gross_profit: grossProfit,
      returns: todayReturns.reduce((s, r) => s + (r.total_return_amount || 0), 0),
      new_customers: newCustomers.length,
    },
    balances: { cash: cashBal, customer_outstanding: customerOutstanding, vendor_outstanding: vendorOutstanding },
    month: { total_sales: monthSales.reduce((s, x) => s + (x.total_amount || 0), 0) },
    alerts: { low_stock_count: (await getLowStock()).length }
  }
}

export async function getDashboardAlerts() {
  const todayStr = today()
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const [lowStockProducts, elec, rent, salaries] = await Promise.all([
    getLowStock(),
    getElectricityBills(),
    getRentPayments(),
    getDocs(query(collection(firestore, 'salaries'), where('status', '==', 'pending'))),
  ])

  const vendorDue = toDocs(await getDocs(query(collection(firestore, 'purchases')))).filter(p => (p.outstanding_amount || 0) > 0 && p.due_date).map(p => ({ ...p, vendor_name: p.vendor_name, urgency: p.due_date < todayStr ? 'overdue' : p.due_date <= in7Days ? 'due_soon' : 'upcoming' })).sort((a, b) => a.due_date?.localeCompare(b.due_date))

  const customerDue = await getCustomerOutstanding()

  const salaryData = toDocs(salaries)
  const currentMonth = todayStr.substring(0, 7)

  return {
    low_stock: lowStockProducts.slice(0, 10),
    vendor_payments_due: vendorDue.slice(0, 10),
    customer_payments_due: customerDue.slice(0, 10),
    electricity_due: elec.filter(e => e.status !== 'paid').slice(0, 5),
    rent_due: rent.filter(r => r.status !== 'paid').slice(0, 5),
    salary_due: { count: salaryData.filter(s => s.salary_month === currentMonth).length, total_amount: salaryData.filter(s => s.salary_month === currentMonth).reduce((s, x) => s + (x.net_salary || 0), 0) },
    slow_moving_stock: (await getStockAging()).data.filter(p => p.age_days > 90).slice(0, 10),
  }
}

export async function getDashboardCharts() {
  const todayStr = today()
  const sales = toDocs(await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed'))))

  // Last 7 days
  const sales7Days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    const total = sales.filter(s => (s.sale_date || s.created_at?.split('T')[0]) === d).reduce((s, x) => s + (x.total_amount || 0), 0)
    sales7Days.push({ date: d, total })
  }

  // Monthly last 6 months
  const monthlySales = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const month = d.toISOString().substring(0, 7)
    const total = sales.filter(s => (s.sale_date || s.created_at || '').substring(0, 7) === month).reduce((s, x) => s + (x.total_amount || 0), 0)
    monthlySales.push({ month, total })
  }

  // Top 5 products this month
  const currentMonth = todayStr.substring(0, 7)
  const allItems = toDocs(await getDocs(query(collection(firestore, 'saleItems'))))
  const monthItems = allItems.filter(si => (si.sale_date || si.created_at || '').substring(0, 7) === currentMonth)
  const byProduct = {}
  monthItems.forEach(si => {
    if (!byProduct[si.product_name]) byProduct[si.product_name] = { product_name: si.product_name, qty_sold: 0, revenue: 0 }
    byProduct[si.product_name].qty_sold += si.quantity
    byProduct[si.product_name].revenue += si.total_price || 0
  })
  const topProducts = Object.values(byProduct).sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 5)

  // Payment modes today
  const todaySales = sales.filter(s => (s.sale_date || s.created_at?.split('T')[0]) === todayStr)
  const paymentModes = { cash: todaySales.reduce((s, x) => s + (x.cash_amount || 0), 0), upi: todaySales.reduce((s, x) => s + (x.upi_amount || 0), 0), card: todaySales.reduce((s, x) => s + (x.card_amount || 0), 0), credit: todaySales.reduce((s, x) => s + (x.credit_amount || 0), 0) }

  return { sales7Days, topProducts, monthlySales, paymentModes }
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export async function getSalesReport({ from, to }) {
  const sales = toDocs(await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed'))))
  let filtered = sales
  if (from) filtered = filtered.filter(s => (s.sale_date || s.created_at) >= from)
  if (to) filtered = filtered.filter(s => (s.sale_date || s.created_at) <= to + 'T23:59:59')
  const summary = { total_sales: filtered.reduce((s, x) => s + (x.total_amount || 0), 0), total_bills: filtered.length, cash: filtered.reduce((s, x) => s + (x.cash_amount || 0), 0), upi: filtered.reduce((s, x) => s + (x.upi_amount || 0), 0), card: filtered.reduce((s, x) => s + (x.card_amount || 0), 0), credit: filtered.reduce((s, x) => s + (x.credit_amount || 0), 0) }
  return { data: filtered, summary }
}

export async function getPurchaseReport({ from, to }) {
  const purchases = toDocs(await getDocs(query(collection(firestore, 'purchases'))))
  let filtered = purchases
  if (from) filtered = filtered.filter(p => (p.purchase_date || p.created_at) >= from)
  if (to) filtered = filtered.filter(p => (p.purchase_date || p.created_at) <= to + 'T23:59:59')
  const summary = { total: filtered.reduce((s, x) => s + (x.total_amount || 0), 0), count: filtered.length }
  return { data: filtered, summary }
}

export async function getProfitReport({ from, to }) {
  const items = toDocs(await getDocs(query(collection(firestore, 'saleItems'))))
  const sales = toDocs(await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed'))))
  const validSaleIds = new Set(sales.filter(s => (!from || (s.sale_date || s.created_at) >= from) && (!to || (s.sale_date || s.created_at) <= to + 'T23:59:59')).map(s => s.id))
  const filteredItems = items.filter(i => validSaleIds.has(i.sale_id))
  const grossProfit = filteredItems.reduce((s, si) => s + ((si.unit_price * (1 - (si.discount_percent || 0)/100) - (si.purchase_price || 0)) * si.quantity), 0)
  return { gross_profit: grossProfit, total_revenue: filteredItems.reduce((s, si) => s + (si.total_price || 0), 0), item_count: filteredItems.length }
}

// ─── REMINDERS ───────────────────────────────────────────────────────────────

export async function getReminders({ status = '' } = {}) {
  let snap = await getDocs(query(collection(firestore, 'reminders'), orderBy('due_date', 'asc'), limit(200)))
  let data = toDocs(snap)
  if (status) data = data.filter(r => r.status === status)
  return data
}

export async function createReminder(data) {
  const ref = await addDoc(collection(firestore, 'reminders'), { ...data, status: 'pending', created_at: now() })
  return { id: ref.id }
}

export async function updateReminderStatus(id, status) {
  await updateDoc(doc(firestore, 'reminders', id), { status, completed_at: status === 'completed' ? now() : null, updated_at: now() })
}

export async function updateReminder(id, data) {
  await updateDoc(doc(firestore, 'reminders', id), { ...data, updated_at: now() })
}

export async function deleteReminder(id) { await deleteDoc(doc(firestore, 'reminders', id)) }

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export async function getDocuments({ document_type, search } = {}) {
  let snap = await getDocs(query(collection(firestore, 'documents'), orderBy('created_at', 'desc'), limit(200)))
  let data = toDocs(snap)
  if (document_type) data = data.filter(d => d.document_type === document_type)
  if (search) { const s = search.toLowerCase(); data = data.filter(d => d.title?.toLowerCase().includes(s) || d.tags?.toLowerCase().includes(s)) }
  return { data, total: data.length }
}

export async function createDocument(data, userId) {
  const ref = await addDoc(collection(firestore, 'documents'), { ...data, uploaded_by: userId || null, created_at: now() })
  return { id: ref.id }
}

export async function deleteDocument(id) { await deleteDoc(doc(firestore, 'documents', id)) }

// ─── USERS ───────────────────────────────────────────────────────────────────

export async function getUsers() {
  const snap = await getDocs(query(collection(firestore, 'users'), orderBy('full_name')))
  return toDocs(snap)
}

export async function createUser({ username, password, full_name, email, mobile, role }) {
  const userEmail = usernameToEmail(username)
  const cred = await createUserWithEmailAndPassword(auth, userEmail, password)
  await setDoc(doc(firestore, 'users', cred.user.uid), { username: username.toLowerCase().trim(), full_name, email: email || '', mobile: mobile || '', role: role || 'billing', is_active: true, created_at: now() })
  return { id: cred.user.uid, username }
}

export async function updateUser(id, data) {
  await updateDoc(doc(firestore, 'users', id), { ...data, updated_at: now() })
}

// ─── AUDIT ───────────────────────────────────────────────────────────────────

export async function getAuditLog({ module, from, to } = {}) {
  let snap = await getDocs(query(collection(firestore, 'auditLogs'), orderBy('created_at', 'desc'), limit(200)))
  let data = toDocs(snap)
  if (module) data = data.filter(a => a.module === module)
  if (from) data = data.filter(a => a.created_at >= from)
  if (to) data = data.filter(a => a.created_at <= to + 'T23:59:59')
  return { data, total: data.length }
}

export async function addAuditLog({ userId, username, action, module, record_id, old_values, new_values }) {
  await addDoc(collection(firestore, 'auditLogs'), { user_id: userId || null, username: username || '', action, module, record_id: record_id || null, old_values: old_values ? JSON.stringify(old_values) : null, new_values: new_values ? JSON.stringify(new_values) : null, created_at: now() })
}

// ─── ALIASES & MISSING FUNCTIONS ─────────────────────────────────────────────

// AuditLog alias (pages use getAuditLogs)
export async function getAuditLogs({ module, from, to, limit: lim = 200 } = {}) {
  let snap = await getDocs(query(collection(firestore, 'auditLogs'), orderBy('created_at', 'desc'), limit(lim)))
  let data = toDocs(snap)
  if (module) data = data.filter(a => a.module === module)
  if (from) data = data.filter(a => a.created_at >= from)
  if (to) data = data.filter(a => a.created_at <= to + 'T23:59:59')
  return { data, total: data.length }
}

// Ledger helpers for CustomerDetail / VendorDetail
export async function getCustomerLedger(customerId) {
  const snap = await getDocs(query(collection(firestore, 'customerLedger'), where('customer_id', '==', customerId), orderBy('created_at', 'desc'), limit(100)))
  return toDocs(snap)
}

export async function getVendorLedger(vendorId) {
  const snap = await getDocs(query(collection(firestore, 'vendorLedger'), where('vendor_id', '==', vendorId), orderBy('created_at', 'desc'), limit(100)))
  return toDocs(snap)
}

// Attendance alias (saveAttendance → markAttendance)
export const saveAttendance = markAttendance

// Salary helpers
export async function generateSalaries(month, employees, userId) {
  const existing = await getSalaries({ month })
  const existingEmpIds = new Set(existing.length > 0 ? existing.map(s => s.employee_id) : [])
  const batch = writeBatch(firestore)
  for (const emp of (employees || [])) {
    if (existingEmpIds.has(emp.id)) continue
    const ref = doc(collection(firestore, 'salaries'))
    batch.set(ref, {
      employee_id: emp.id, employee_name: emp.name, designation: emp.designation || '',
      salary_month: month, base_salary: Number(emp.basic_salary || 0),
      bonus_amount: 0, deduction_amount: 0,
      net_salary: Number(emp.basic_salary || 0),
      status: 'pending', created_by: userId || null, created_at: now()
    })
  }
  await batch.commit()
}

export async function paySalary(id, { payment_date, payment_mode }, userId) {
  const snap = await getDoc(doc(firestore, 'salaries', id))
  if (!snap.exists()) throw new Error('Salary record not found')
  const salary = snap.data()
  await updateDoc(doc(firestore, 'salaries', id), { status: 'paid', payment_date: payment_date || today(), payment_mode, paid_at: now(), updated_at: now() })
  if (payment_mode === 'cash') await addCashOutflow(salary.net_salary || 0, `Salary - ${salary.employee_name}`, 'salary', id, payment_date || today(), userId)
}

// Bank aliases
export const addBankAccount = createBankAccount

// Fix addBankTransaction to accept (accountId, data, userId)
export async function addBankTransactionFixed(accountId, txData, userId) {
  const accountSnap = await getDoc(doc(firestore, 'bankAccounts', accountId))
  if (!accountSnap.exists()) throw new Error('Account not found')
  const acct = accountSnap.data()
  const isInflow = txData.is_inflow !== undefined ? txData.is_inflow : ['deposit', 'receipt'].includes(txData.transaction_type)
  const newBalance = isInflow ? (acct.current_balance || 0) + Number(txData.amount) : (acct.current_balance || 0) - Number(txData.amount)
  await updateDoc(doc(firestore, 'bankAccounts', accountId), { current_balance: newBalance })
  await addDoc(collection(firestore, 'bankTransactions'), {
    account_id: accountId, account_name: acct.account_name,
    transaction_date: txData.transaction_date || today(), transaction_type: txData.transaction_type,
    description: txData.description, amount: isInflow ? Number(txData.amount) : -Number(txData.amount),
    balance_after: newBalance, reference_number: txData.reference_number || null,
    created_by: userId || null, created_at: now()
  })
}

// Rent aliases
export const getRentRecords = getRentPayments
export const addRentRecord = createRentPayment

// Overwrite payRent to accept string mode
export async function payRentByMode(id, mode, userId) {
  const snap = await getDoc(doc(firestore, 'rentPayments', id))
  if (!snap.exists()) throw new Error('Rent record not found')
  const rent = snap.data()
  await updateDoc(doc(firestore, 'rentPayments', id), { status: 'paid', payment_date: today(), payment_mode: mode, updated_at: now() })
  if (mode === 'cash') await addCashOutflow(rent.amount || 0, 'Shop Rent', 'rent', id, today(), userId)
}

// Electricity aliases with userId support
export const addElectricityBill = createElectricityBill

export async function payElectricityBillByMode(id, mode, userId) {
  const snap = await getDoc(doc(firestore, 'electricityBills', id))
  if (!snap.exists()) throw new Error('Electricity bill not found')
  const bill = snap.data()
  await updateDoc(doc(firestore, 'electricityBills', id), { status: 'paid', payment_date: today(), payment_mode: mode, updated_at: now() })
  if (mode === 'cash') await addCashOutflow(bill.bill_amount || 0, 'Electricity Bill', 'electricity', id, today(), userId)
}

// Finance summary & reconciliation
export async function getFinanceSummary() {
  const [cashTx, bankAccs, sales, purchases, expenses] = await Promise.all([
    getDocs(query(collection(firestore, 'cashTransactions'), orderBy('created_at', 'desc'), limit(1))),
    getDocs(query(collection(firestore, 'bankAccounts'), where('is_active', '==', true))),
    getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed'))),
    getDocs(query(collection(firestore, 'purchases'))),
    getDocs(query(collection(firestore, 'expenses'))),
  ])
  const cashBalance = cashTx.docs[0]?.data()?.balance_after || 0
  const banksData = toDocs(bankAccs)
  const totalBank = banksData.reduce((s, a) => s + (a.current_balance || 0), 0)
  const salesData = toDocs(sales)
  const purchasesData = toDocs(purchases)
  const expData = toDocs(expenses)
  const monthStart = today().substring(0,7) + '-01'

  return {
    cash_balance: cashBalance,
    total_bank: totalBank,
    total_liquid: cashBalance + totalBank,
    bank_accounts: banksData,
    customer_receivable: salesData.filter(s => (s.credit_amount || 0) > (s.paid_amount || 0)).reduce((s, x) => s + ((x.credit_amount || 0) - (x.paid_amount || 0)), 0),
    vendor_payable: purchasesData.filter(p => (p.outstanding_amount || 0) > 0).reduce((s, p) => s + (p.outstanding_amount || 0), 0),
    month_expenses: expData.filter(e => (e.expense_date || '') >= monthStart).reduce((s, e) => s + (e.amount || 0), 0),
  }
}

export async function getReconciliation(date) {
  const txSnap = await getDocs(query(collection(firestore, 'cashTransactions'), orderBy('created_at', 'asc')))
  const allTx = toDocs(txSnap)
  const dayTx = allTx.filter(t => t.transaction_date === date)
  const receipts = dayTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const payments = dayTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const beforeDay = allTx.filter(t => t.transaction_date < date)
  const openingCash = beforeDay.length > 0 ? beforeDay[beforeDay.length - 1].balance_after || 0 : 0
  return {
    date, opening_cash: openingCash, receipts, payments,
    expected_closing: openingCash + receipts - payments
  }
}

// Credit outstanding alias
export async function getCreditOutstanding() {
  const snap = await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed')))
  const salesData = toDocs(snap)
  const today_str = today()
  const byCustomer = {}
  salesData.forEach(s => {
    const outstanding = (s.credit_amount || 0) - (s.paid_amount || 0)
    if (!s.customer_id || outstanding <= 0) return
    if (!byCustomer[s.customer_id]) byCustomer[s.customer_id] = {
      id: s.customer_id, name: s.customer_name || '', mobile: s.customer_mobile || '',
      outstanding: 0, pending_bills: 0, last_sale_date: s.sale_date || ''
    }
    byCustomer[s.customer_id].outstanding += outstanding
    byCustomer[s.customer_id].pending_bills += 1
    if ((s.sale_date || '') > byCustomer[s.customer_id].last_sale_date) byCustomer[s.customer_id].last_sale_date = s.sale_date || ''
  })
  const data = Object.values(byCustomer)
    .filter(c => c.outstanding > 0)
    .map(c => ({ ...c, days_outstanding: c.last_sale_date ? Math.floor((Date.now() - new Date(c.last_sale_date).getTime()) / 86400000) : 0 }))
    .sort((a, b) => b.outstanding - a.outstanding)
  return { data, total: data.reduce((s, c) => s + c.outstanding, 0) }
}

// Generic report dispatcher
export async function getReport(type, params = {}) {
  const { from, to, month } = params
  if (type === 'sales') return getSalesReport({ from, to })
  if (type === 'profit') {
    const [items, sales, expenses] = await Promise.all([
      getDocs(query(collection(firestore, 'saleItems'))),
      getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed'))),
      getDocs(query(collection(firestore, 'expenses'))),
    ])
    const salesData = toDocs(sales)
    const validSaleIds = new Set(salesData.filter(s => (!from || (s.sale_date || s.created_at) >= from) && (!to || (s.sale_date || s.created_at) <= to + 'T23:59:59')).map(s => s.id))
    const filteredItems = toDocs(items).filter(i => validSaleIds.has(i.sale_id))
    const filteredSales = salesData.filter(s => validSaleIds.has(s.id))
    const filteredExp = toDocs(expenses).filter(e => (!from || e.expense_date >= from) && (!to || e.expense_date <= to))
    const grossProfit = filteredItems.reduce((s, si) => s + ((si.unit_price * (1-(si.discount_percent||0)/100) - (si.purchase_price||0)) * si.quantity), 0)
    const totalRevenue = filteredItems.reduce((s, si) => s + (si.total_price || 0), 0)
    const expenses_total = filteredExp.reduce((s, e) => s + (e.amount || 0), 0)
    return { data: filteredSales, summary: { total_revenue: totalRevenue, gross_profit: grossProfit, net_profit: grossProfit - expenses_total, expenses: expenses_total, total_cost: totalRevenue - grossProfit } }
  }
  if (type === 'stock') {
    const { data } = await getProducts({ is_active: true, limit: 500 })
    const total_value = data.reduce((s, p) => s + ((p.total_stock || 0) * (p.purchase_price || 0)), 0)
    return { data: data.map(p => ({ ...p, stock_value: (p.total_stock || 0) * (p.purchase_price || 0) })), summary: { total_products: data.length, total_value } }
  }
  if (type === 'expenses') {
    const r = await getExpenses({ from, to })
    const by_category = {}
    r.data.forEach(e => { const k = e.category_name || 'Other'; by_category[k] = (by_category[k] || 0) + (e.amount || 0) })
    return { data: r.data, by_category: Object.entries(by_category).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total), total: r.totals.total }
  }
  if (type === 'credit-outstanding') return getCreditOutstanding()
  if (type === 'product-performance') {
    const items = toDocs(await getDocs(query(collection(firestore, 'saleItems'))))
    const salesData = toDocs(await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed'))))
    const validIds = new Set(salesData.filter(s => (!from || (s.sale_date || s.created_at) >= from) && (!to || (s.sale_date || s.created_at) <= to + 'T23:59:59')).map(s => s.id))
    const filtered = items.filter(i => validIds.has(i.sale_id))
    const byProduct = {}
    filtered.forEach(si => {
      if (!byProduct[si.product_id]) byProduct[si.product_id] = { product_name: si.product_name, qty_sold: 0, revenue: 0, profit: 0 }
      byProduct[si.product_id].qty_sold += si.quantity
      byProduct[si.product_id].revenue += si.total_price || 0
      byProduct[si.product_id].profit += (si.unit_price * (1-(si.discount_percent||0)/100) - (si.purchase_price||0)) * si.quantity
    })
    const data = Object.values(byProduct).sort((a, b) => b.qty_sold - a.qty_sold)
    return { data }
  }
  if (type === 'salary') {
    const r = await getSalaries({ month })
    return { data: r.data || r, summary: { total: (r.data || r).reduce((s, x) => s + (x.net_salary || 0), 0) } }
  }
  if (type === 'daily') {
    const dateStr = from || today()
    const snap = await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed')))
    const allSales = toDocs(snap).filter(s => (s.sale_date || s.created_at?.split('T')[0]) === dateStr)
    const expSnap = await getDocs(query(collection(firestore, 'expenses')))
    const dayExp = toDocs(expSnap).filter(e => e.expense_date === dateStr)
    const purSnap = await getDocs(query(collection(firestore, 'purchases')))
    const dayPur = toDocs(purSnap).filter(p => (p.purchase_date || p.created_at?.split('T')[0]) === dateStr)
    const items = toDocs(await getDocs(query(collection(firestore, 'saleItems')))).filter(si => si.sale_date === dateStr)
    const gross_profit = items.reduce((s, si) => s + ((si.unit_price*(1-(si.discount_percent||0)/100) - (si.purchase_price||0)) * si.quantity), 0)
    const custSnap = await getDocs(query(collection(firestore, 'customers')))
    const outstanding = toDocs(await getDocs(query(collection(firestore, 'sales'), where('status', '==', 'completed')))).filter(s => (s.credit_amount||0) > (s.paid_amount||0)).reduce((s, x) => s + ((x.credit_amount||0)-(x.paid_amount||0)), 0)
    return { total_sales: allSales.reduce((s,x)=>s+(x.total_amount||0),0), bills: allSales.length, cash_sales: allSales.reduce((s,x)=>s+(x.cash_amount||0),0), upi_sales: allSales.reduce((s,x)=>s+(x.upi_amount||0),0), credit_sales: allSales.reduce((s,x)=>s+(x.credit_amount||0),0), purchases: dayPur.reduce((s,p)=>s+(p.total_amount||0),0), expenses: dayExp.reduce((s,e)=>s+(e.amount||0),0), gross_profit, customer_outstanding: outstanding }
  }
  return null
}

// ─── DELETE FUNCTIONS (full CRUD for every module) ────────────────────────────

// Customers
export async function deleteCustomer(id) {
  await deleteDoc(doc(firestore, 'customers', id))
}

// Vendors
export async function deleteVendor(id) {
  await deleteDoc(doc(firestore, 'vendors', id))
}

// Products (hard delete only — soft delete already exists above)
export async function hardDeleteProduct(id) {
  await deleteDoc(doc(firestore, 'products', id))
}

// Sales — delete sale and restore stock
export async function deleteSale(saleId) {
  const saleSnap = await getDoc(doc(firestore, 'sales', saleId))
  if (!saleSnap.exists()) throw new Error('Sale not found')
  const sale = saleSnap.data()

  // Restore stock for each item
  const itemsSnap = await getDocs(query(collection(firestore, 'saleItems'), where('sale_id', '==', saleId)))
  const batch = writeBatch(firestore)
  itemsSnap.docs.forEach(itemDoc => {
    const item = itemDoc.data()
    if (item.product_id) {
      batch.update(doc(firestore, 'products', item.product_id), { total_stock: increment(item.quantity) })
    }
    batch.delete(itemDoc.ref)
  })

  batch.delete(doc(firestore, 'sales', saleId))
  await batch.commit()
}

// Purchases — delete purchase
export async function deletePurchase(id) {
  const snap = await getDoc(doc(firestore, 'purchases', id))
  if (!snap.exists()) return
  const purchase = snap.data()

  // Reverse stock additions
  const itemsSnap = await getDocs(query(collection(firestore, 'purchaseItems'), where('purchase_id', '==', id)))
  const batch = writeBatch(firestore)
  itemsSnap.docs.forEach(itemDoc => {
    const item = itemDoc.data()
    if (item.product_id) {
      batch.update(doc(firestore, 'products', item.product_id), { total_stock: increment(-item.quantity) })
    }
    batch.delete(itemDoc.ref)
  })
  batch.delete(doc(firestore, 'purchases', id))
  await batch.commit()
}

// Sale Returns — delete
export async function deleteSaleReturn(id) {
  await deleteDoc(doc(firestore, 'saleReturns', id))
}

// Electricity
export async function deleteElectricityBill(id) {
  await deleteDoc(doc(firestore, 'electricityBills', id))
}
export async function updateElectricityBill(id, data) {
  await updateDoc(doc(firestore, 'electricityBills', id), { ...data, updated_at: now() })
}

// Rent
export async function deleteRentRecord(id) {
  await deleteDoc(doc(firestore, 'rentPayments', id))
}
export async function updateRentRecord(id, data) {
  await updateDoc(doc(firestore, 'rentPayments', id), { ...data, updated_at: now() })
}

// Recurring Expenses
export async function deleteRecurringExpense(id) {
  await deleteDoc(doc(firestore, 'recurringExpenses', id))
}
export async function updateRecurringExpense(id, data) {
  await updateDoc(doc(firestore, 'recurringExpenses', id), { ...data, updated_at: now() })
}

// Employees
export async function deleteEmployee(id) {
  await updateDoc(doc(firestore, 'employees', id), { is_active: false, deleted_at: now() })
}
export async function hardDeleteEmployee(id) {
  await deleteDoc(doc(firestore, 'employees', id))
}

// Salary
export async function deleteSalaryRecord(id) {
  await deleteDoc(doc(firestore, 'salaries', id))
}

// Attendance
export async function deleteAttendanceRecord(id) {
  await deleteDoc(doc(firestore, 'attendance', id))
}

// Bank Accounts
export async function deleteBankAccount(id) {
  await updateDoc(doc(firestore, 'bankAccounts', id), { is_active: false, deleted_at: now() })
}
export async function deleteBankTransaction(id) {
  await deleteDoc(doc(firestore, 'bankTransactions', id))
}
export async function updateBankAccount(id, data) {
  await updateDoc(doc(firestore, 'bankAccounts', id), { ...data, updated_at: now() })
}

// Cash transactions
export async function deleteCashTransaction(id) {
  await deleteDoc(doc(firestore, 'cashTransactions', id))
}

export async function updateCashTransaction(id, data) {
  await updateDoc(doc(firestore, 'cashTransactions', id), { ...data, updated_at: now() })
}

// Stock adjustments — reverses the stock change on delete
export async function deleteStockAdjustment(id) {
  const snap = await getDoc(doc(firestore, 'stockAdjustments', id))
  if (!snap.exists()) return
  const adj = snap.data()
  // Reverse the stock change: if adjustment was +5, revert by -5
  if (adj.product_id && adj.quantity_change !== undefined) {
    await runTransaction(firestore, async (tx) => {
      await updateProductStockInTx(tx, adj.product_id, -Number(adj.quantity_change))
    })
  }
  await deleteDoc(doc(firestore, 'stockAdjustments', id))
}

// Users (Admin)
export async function deleteUserAccount(uid) {
  await updateDoc(doc(firestore, 'users', uid), { is_active: false, deleted_at: now() })
}
