import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

admin.initializeApp()
const db = admin.firestore()

// ─── HELPER ─────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function currentMonth(): string {
  return new Date().toISOString().substring(0, 7)
}

// ─── TRIGGER: Update customer outstanding on sale ────────────────

export const onSaleCreated = onDocumentCreated('sales/{saleId}', async (event) => {
  const sale = event.data?.data()
  if (!sale || sale.status !== 'completed') return

  // Auto-create reminder if credit sale
  if ((sale.creditAmount || 0) > 0 && sale.customerId) {
    await db.collection('reminders').add({
      reminderType: 'customer_payment',
      referenceId: event.params.saleId,
      title: `Collect payment from ${sale.customerName}`,
      description: `Invoice ${sale.invoiceNumber} — Credit ₹${sale.creditAmount}`,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      amount: sale.creditAmount,
      status: 'upcoming',
      priority: 'normal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  // Update daily summary
  const today = sale.saleDate || todayStr()
  const summaryRef = db.collection('dailySummaries').doc(today)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(summaryRef)
    const cur = snap.exists ? snap.data()! : {
      totalSales: 0, totalBills: 0, cashSales: 0, upiSales: 0,
      cardSales: 0, creditSales: 0, totalCost: 0, date: today,
    }
    tx.set(summaryRef, {
      ...cur,
      totalSales: (cur.totalSales || 0) + (sale.totalAmount || 0),
      totalBills: (cur.totalBills || 0) + 1,
      cashSales: (cur.cashSales || 0) + (sale.cashAmount || 0),
      upiSales: (cur.upiSales || 0) + (sale.upiAmount || 0),
      cardSales: (cur.cardSales || 0) + (sale.cardAmount || 0),
      creditSales: (cur.creditSales || 0) + (sale.creditAmount || 0),
      totalCost: (cur.totalCost || 0) + (sale.totalCost || 0),
      grossProfit: ((cur.totalSales || 0) + (sale.totalAmount || 0)) - ((cur.totalCost || 0) + (sale.totalCost || 0)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  })
})

// ─── TRIGGER: Vendor outstanding on purchase ─────────────────────

export const onPurchaseCreated = onDocumentCreated('purchases/{purchaseId}', async (event) => {
  const purchase = event.data?.data()
  if (!purchase || !purchase.vendorId || (purchase.outstandingAmount || 0) <= 0) return

  const dueDate = purchase.dueDate || new Date(Date.now() + (purchase.paymentTerms || 30) * 86400000).toISOString().split('T')[0]

  await db.collection('reminders').add({
    reminderType: 'vendor_payment',
    referenceId: event.params.purchaseId,
    title: `Pay vendor: ${purchase.vendorName}`,
    description: `Purchase ${purchase.purchaseNumber} — Outstanding ₹${purchase.outstandingAmount}`,
    dueDate,
    amount: purchase.outstandingAmount,
    status: 'upcoming',
    priority: 'normal',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
})

// ─── SCHEDULED: Daily Summary (runs every day at 11:00 PM IST) ───

export const generateDailySummary = onSchedule(
  { schedule: '30 17 * * *', timeZone: 'Asia/Kolkata' }, // 17:30 UTC = 23:00 IST
  async () => {
    const today = todayStr()
    console.log(`Generating daily summary for ${today}`)

    const [salesSnap, purchasesSnap, expensesSnap] = await Promise.all([
      db.collection('sales').where('saleDate', '==', today).where('status', '==', 'completed').get(),
      db.collection('purchases').where('purchaseDate', '==', today).get(),
      db.collection('expenses').where('expenseDate', '==', today).get(),
    ])

    const summary: Record<string, number> = {
      totalSales: 0, totalBills: 0, cashSales: 0, upiSales: 0,
      cardSales: 0, creditSales: 0, totalCost: 0, totalPurchases: 0, totalExpenses: 0,
    }

    salesSnap.forEach(d => {
      const s = d.data()
      summary.totalSales += s.totalAmount || 0
      summary.totalBills++
      summary.cashSales += s.cashAmount || 0
      summary.upiSales += s.upiAmount || 0
      summary.cardSales += s.cardAmount || 0
      summary.creditSales += s.creditAmount || 0
      summary.totalCost += s.totalCost || 0
    })

    purchasesSnap.forEach(d => { summary.totalPurchases += d.data().totalAmount || 0 })
    expensesSnap.forEach(d => { summary.totalExpenses += d.data().amount || 0 })
    summary.grossProfit = summary.totalSales - summary.totalCost

    await db.collection('dailySummaries').doc(today).set({
      ...summary, date: today,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    console.log(`Daily summary saved: ₹${summary.totalSales} sales, ₹${summary.grossProfit} profit`)
  }
)

// ─── SCHEDULED: Update reminder statuses (runs every 6 hours) ────

export const updateReminderStatuses = onSchedule(
  { schedule: '0 */6 * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const today = todayStr()
    const todayDate = new Date(today)
    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)

    const remindersSnap = await db.collection('reminders')
      .where('status', 'in', ['upcoming', 'due_soon'])
      .get()

    const batch = db.batch()
    let updated = 0

    remindersSnap.forEach(doc => {
      const reminder = doc.data()
      const dueDate = new Date(reminder.dueDate)
      let newStatus = reminder.status

      if (dueDate < todayDate) newStatus = 'overdue'
      else if (dueDate.toISOString().split('T')[0] === today) newStatus = 'due_today'
      else if (dueDate <= threeDaysLater) newStatus = 'due_soon'
      else newStatus = 'upcoming'

      if (newStatus !== reminder.status) {
        batch.update(doc.ref, { status: newStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        updated++
      }
    })

    await batch.commit()
    console.log(`Updated ${updated} reminder statuses`)
  }
)

// ─── SCHEDULED: Monthly salary reminders (1st of each month) ─────

export const monthlySalaryReminder = onSchedule(
  { schedule: '0 8 1 * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const month = currentMonth()
    const dueDate = `${month}-07` // Salary due by 7th

    const existingSnap = await db.collection('reminders')
      .where('reminderType', '==', 'salary')
      .where('dueDate', '==', dueDate)
      .get()

    if (!existingSnap.empty) {
      console.log('Salary reminder already exists for this month')
      return
    }

    // Get active employees count
    const empSnap = await db.collection('employees').where('status', '==', 'active').get()
    const totalSalary = empSnap.docs.reduce((s, d) => s + (d.data().basicSalary || 0), 0)

    await db.collection('reminders').add({
      reminderType: 'salary',
      title: `Process salaries for ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
      description: `${empSnap.size} employees · Estimated ₹${totalSalary.toLocaleString('en-IN')}`,
      dueDate,
      amount: totalSalary,
      status: 'upcoming',
      priority: 'high',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`Salary reminder created for ${month}: ₹${totalSalary}`)
  }
)

// ─── CALLABLE: Create first admin user (setup only) ──────────────

export const setupFirstAdmin = onCall(async (request) => {
  const { email, name, uid } = request.data

  if (!uid || !email || !name) throw new HttpsError('invalid-argument', 'uid, email, and name are required')

  // Check if any owner already exists
  const existingOwner = await db.collection('users').where('role', '==', 'owner').get()
  if (!existingOwner.empty) throw new HttpsError('already-exists', 'Owner already set up')

  await db.collection('users').doc(uid).set({
    uid, name, email, role: 'owner', status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { success: true, message: 'Owner account created' }
})

// ─── CALLABLE: Get profit report ─────────────────────────────────

export const getProfitReport = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in')

  const { month } = request.data // e.g. "2026-09"
  if (!month) throw new HttpsError('invalid-argument', 'Month required (YYYY-MM)')

  const startDate = `${month}-01`
  const endDate = `${month}-31`

  const [salesSnap, purchasesSnap, expensesSnap, salariesSnap] = await Promise.all([
    db.collection('sales').where('saleDate', '>=', startDate).where('saleDate', '<=', endDate).where('status', '==', 'completed').get(),
    db.collection('purchases').where('purchaseDate', '>=', startDate).where('purchaseDate', '<=', endDate).get(),
    db.collection('expenses').where('expenseDate', '>=', startDate).where('expenseDate', '<=', endDate).get(),
    db.collection('salaries').where('salaryMonth', '==', month).get(),
  ])

  const totalSales = salesSnap.docs.reduce((s, d) => s + (d.data().totalAmount || 0), 0)
  const totalCost = salesSnap.docs.reduce((s, d) => s + (d.data().totalCost || 0), 0)
  const totalPurchases = purchasesSnap.docs.reduce((s, d) => s + (d.data().totalAmount || 0), 0)
  const totalExpenses = expensesSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0)
  const totalSalaries = salariesSnap.docs.reduce((s, d) => s + (d.data().netSalary || 0), 0)

  const grossProfit = totalSales - totalCost
  const netProfit = grossProfit - totalExpenses - totalSalaries

  return {
    month, totalSales, totalCost, grossProfit,
    totalPurchases, totalExpenses, totalSalaries, netProfit,
    billCount: salesSnap.size,
    generatedAt: new Date().toISOString(),
  }
})
