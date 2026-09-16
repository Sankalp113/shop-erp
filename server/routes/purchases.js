const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');
const { updateStock } = require('../services/stockService');

function generatePurchaseNumber(db) {
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'purchase_prefix'").get()?.value || 'PUR';
  const counter = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'purchase_counter'").get()?.value || '1');
  const num = `${prefix}-${String(counter).padStart(5, '0')}`;
  db.prepare("UPDATE settings SET value = ? WHERE key = 'purchase_counter'").run(String(counter + 1));
  return num;
}

function updateVendorLedger(db, vendorId, transactionType, refType, refId, debit, credit, notes, transactionDate, createdBy) {
  const lastEntry = db.prepare('SELECT balance FROM vendor_ledger WHERE vendor_id = ? ORDER BY id DESC LIMIT 1').get(vendorId);
  const prevBalance = lastEntry ? lastEntry.balance : 0;
  const newBalance = prevBalance + debit - credit;
  db.prepare(`
    INSERT INTO vendor_ledger (vendor_id, transaction_type, reference_type, reference_id, debit, credit, balance, notes, transaction_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(vendorId, transactionType, refType, refId, debit, credit, newBalance, notes, transactionDate, createdBy);
  return newBalance;
}

// GET /api/purchases
router.get('/', (req, res) => {
  const db = getDb();
  const { from, to, vendor_id, status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let where = ['1=1'];
  let params = [];
  if (from) { where.push('date(p.purchase_date) >= ?'); params.push(from); }
  if (to) { where.push('date(p.purchase_date) <= ?'); params.push(to); }
  if (vendor_id) { where.push('p.vendor_id = ?'); params.push(vendor_id); }
  if (status) { where.push('p.status = ?'); params.push(status); }
  const whereStr = where.join(' AND ');
  const purchases = db.prepare(`
    SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE ${whereStr} ORDER BY p.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM purchases p WHERE ${whereStr}`).get(...params);
  res.json({ data: purchases, total: total.count });
});

// GET /api/purchases/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const purchase = db.prepare('SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?').get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id);
  const payments = db.prepare('SELECT * FROM purchase_payments WHERE purchase_id = ? ORDER BY id DESC').all(req.params.id);
  res.json({ ...purchase, items, payments });
});

// POST /api/purchases
router.post('/', (req, res) => {
  const db = getDb();
  const {
    vendor_id, vendor_invoice_number, purchase_date, items,
    discount_amount = 0, paid_amount = 0, payment_mode, due_date, notes
  } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });

  const createPurchase = db.transaction(() => {
    const purchase_number = generatePurchaseNumber(db);
    const pDate = purchase_date || new Date().toISOString().split('T')[0];
    
    let subtotal = 0, tax_amount = 0;
    items.forEach(item => {
      subtotal += item.unit_price * item.quantity;
      tax_amount += (item.unit_price * item.quantity - (item.unit_price * item.quantity * (item.discount_percent || 0) / 100)) * (item.tax_percent || 0) / 100;
    });
    
    const total_amount = subtotal - discount_amount + tax_amount;
    const outstanding_amount = total_amount - paid_amount;
    const status = outstanding_amount <= 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending';

    const pResult = db.prepare(`
      INSERT INTO purchases (purchase_number, vendor_invoice_number, purchase_date, vendor_id, vendor_name,
        subtotal, discount_amount, tax_amount, total_amount, paid_amount, outstanding_amount,
        due_date, payment_mode, notes, status, created_by)
      VALUES (?, ?, ?, ?, (SELECT name FROM vendors WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(purchase_number, vendor_invoice_number || null, pDate, vendor_id || null, vendor_id || null,
      subtotal, discount_amount, tax_amount, total_amount, paid_amount, outstanding_amount,
      due_date || null, payment_mode || null, notes || null, status, req.user.id);

    const purchaseId = pResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, variant_id, product_name, size, color, quantity, unit_price, discount_percent, discount_amount, tax_percent, tax_amount, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    items.forEach(item => {
      const product = db.prepare('SELECT name FROM products WHERE id = ?').get(item.product_id);
      const itemDiscount = item.unit_price * item.quantity * (item.discount_percent || 0) / 100;
      const itemNet = item.unit_price * item.quantity - itemDiscount;
      const itemTax = itemNet * (item.tax_percent || 0) / 100;
      
      insertItem.run(purchaseId, item.product_id, item.variant_id || null,
        product?.name || item.product_name, item.size || null, item.color || null,
        item.quantity, item.unit_price, item.discount_percent || 0, itemDiscount,
        item.tax_percent || 0, itemTax, itemNet + itemTax);

      updateStock(item.product_id, item.variant_id || null, +item.quantity,
        'purchase', 'purchase', purchaseId, `Purchase ${purchase_number}`, req.user.id);
    });

    // Vendor ledger
    if (vendor_id) {
      updateVendorLedger(db, vendor_id, 'purchase', 'purchase', purchaseId,
        total_amount, paid_amount, `Purchase ${purchase_number}`, pDate, req.user.id);
    }

    // Cash transaction for payment
    if (paid_amount > 0 && payment_mode === 'cash') {
      const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
      const newBalance = (lastCash?.balance_after || 0) - paid_amount;
      db.prepare(`INSERT INTO cash_transactions (transaction_date, transaction_type, reference_type, reference_id, description, amount, balance_after, created_by) VALUES (?, 'purchase_payment', 'purchase', ?, ?, ?, ?, ?)`)
        .run(pDate, purchaseId, `Purchase ${purchase_number}`, -paid_amount, newBalance, req.user.id);
    }

    // Create reminder for outstanding
    if (outstanding_amount > 0 && due_date) {
      db.prepare(`INSERT INTO reminders (reminder_type, reference_type, reference_id, title, amount, due_date, priority) VALUES ('vendor_payment', 'purchase', ?, ?, ?, ?, ?)`)
        .run(purchaseId, `Vendor Payment Due - ${purchase_number}`, outstanding_amount, due_date, 'normal');
    }

    auditLog(req.user.id, req.user.username, 'CREATE_PURCHASE', 'purchases', purchaseId, null, { purchase_number, total_amount }, req.ip);
    return { purchaseId, purchase_number, total_amount };
  });

  try {
    const result = createPurchase();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/purchases/:id/payment
router.post('/:id/payment', (req, res) => {
  const db = getDb();
  const { amount, payment_mode, payment_date, reference_number, notes } = req.body;
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  if (amount > purchase.outstanding_amount) return res.status(400).json({ error: 'Amount exceeds outstanding' });

  const makePayment = db.transaction(() => {
    const pDate = payment_date || new Date().toISOString().split('T')[0];
    
    db.prepare('INSERT INTO purchase_payments (purchase_id, payment_date, amount, payment_mode, reference_number, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(purchase.id, pDate, amount, payment_mode, reference_number || null, notes || null, req.user.id);

    const newOutstanding = purchase.outstanding_amount - amount;
    const newPaid = purchase.paid_amount + amount;
    const status = newOutstanding <= 0 ? 'paid' : 'partial';
    
    db.prepare('UPDATE purchases SET paid_amount = ?, outstanding_amount = ?, status = ? WHERE id = ?')
      .run(newPaid, newOutstanding, status, purchase.id);

    if (purchase.vendor_id) {
      updateVendorLedger(db, purchase.vendor_id, 'payment', 'purchase', purchase.id, 0, amount, `Payment for ${purchase.purchase_number}`, pDate, req.user.id);
    }

    if (payment_mode === 'cash') {
      const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
      const newBalance = (lastCash?.balance_after || 0) - amount;
      db.prepare('INSERT INTO cash_transactions (transaction_date, transaction_type, reference_type, reference_id, description, amount, balance_after, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(pDate, 'purchase_payment', 'purchase', purchase.id, `Payment - ${purchase.purchase_number}`, -amount, newBalance, req.user.id);
    }

    auditLog(req.user.id, req.user.username, 'PURCHASE_PAYMENT', 'purchases', purchase.id, null, { amount, status }, req.ip);
  });

  makePayment();
  res.json({ message: 'Payment recorded successfully' });
});

module.exports = router;
