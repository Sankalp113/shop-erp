const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');

// GET /api/customers
router.get('/', (req, res) => {
  const db = getDb();
  const { search, is_active = 1, page = 1, limit = 50 } = req.query;
  let where = ['c.is_active = ?'];
  let params = [is_active];
  if (search) { where.push('(c.name LIKE ? OR c.mobile LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const customers = db.prepare(`
    SELECT c.*,
      COALESCE(SUM(s.credit_amount - s.paid_amount), 0) as outstanding,
      MAX(s.created_at) as last_purchase_date,
      COUNT(s.id) as total_bills,
      COALESCE(SUM(s.total_amount), 0) as total_purchase_value
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'completed'
    WHERE ${where.join(' AND ')}
    GROUP BY c.id ORDER BY c.name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM customers c WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: customers, total: total.count });
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const ledger = db.prepare('SELECT * FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 50').all(req.params.id);
  const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? AND status = "completed" ORDER BY id DESC LIMIT 20').all(req.params.id);
  const stats = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total_purchased, COALESCE(SUM(credit_amount - paid_amount), 0) as outstanding FROM sales WHERE customer_id = ? AND status = "completed"').get(req.params.id);
  res.json({ ...customer, ledger, recent_sales: sales, stats });
});

// POST /api/customers
router.post('/', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const customer_code = `CUS${String(count + 1).padStart(5, '0')}`;
  const { name, mobile, email, address, city, credit_limit, opening_balance, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name required' });
  const r = db.prepare(`INSERT INTO customers (customer_code, name, mobile, email, address, city, credit_limit, opening_balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(customer_code, name, mobile || null, email || null, address || null, city || null, credit_limit || 0, opening_balance || 0, notes || null);
  
  if (opening_balance > 0) {
    const lastEntry = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(r.lastInsertRowid);
    db.prepare('INSERT INTO customer_ledger (customer_id, transaction_type, debit, credit, balance, notes, transaction_date, created_by) VALUES (?, "opening", ?, 0, ?, "Opening balance", ?, ?)')
      .run(r.lastInsertRowid, opening_balance, opening_balance, new Date().toISOString().split('T')[0], req.user.id);
  }

  auditLog(req.user.id, req.user.username, 'CREATE_CUSTOMER', 'customers', r.lastInsertRowid, null, { name, customer_code }, req.ip);
  res.status(201).json({ id: r.lastInsertRowid, customer_code });
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Customer not found' });
  const { name, mobile, email, address, city, credit_limit, notes, is_active } = req.body;
  db.prepare(`UPDATE customers SET name=?, mobile=?, email=?, address=?, city=?, credit_limit=?, notes=?, is_active=?, updated_at=? WHERE id=?`)
    .run(name || old.name, mobile, email, address, city, credit_limit ?? old.credit_limit, notes, is_active !== undefined ? is_active : old.is_active, new Date().toISOString(), req.params.id);
  auditLog(req.user.id, req.user.username, 'UPDATE_CUSTOMER', 'customers', req.params.id, old, req.body, req.ip);
  res.json({ message: 'Customer updated' });
});

// POST /api/customers/:id/payment
router.post('/:id/payment', (req, res) => {
  const db = getDb();
  const { amount, payment_mode, payment_date, notes } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const recordPayment = db.transaction(() => {
    const pDate = payment_date || new Date().toISOString().split('T')[0];
    
    // Update credit sales as partially paid (FIFO)
    const creditSales = db.prepare('SELECT * FROM sales WHERE customer_id = ? AND credit_amount > paid_amount AND status = "completed" ORDER BY id ASC').all(req.params.id);
    let remaining = amount;
    creditSales.forEach(sale => {
      if (remaining <= 0) return;
      const owed = sale.credit_amount - sale.paid_amount;
      const toApply = Math.min(remaining, owed);
      db.prepare('UPDATE sales SET paid_amount = paid_amount + ? WHERE id = ?').run(toApply, sale.id);
      remaining -= toApply;
    });

    // Customer ledger entry
    const lastEntry = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    const newBalance = (lastEntry?.balance || 0) - amount;
    db.prepare('INSERT INTO customer_ledger (customer_id, transaction_type, debit, credit, balance, notes, transaction_date, created_by) VALUES (?, "payment", 0, ?, ?, ?, ?, ?)')
      .run(req.params.id, amount, newBalance, notes || 'Payment received', pDate, req.user.id);

    // Cash transaction
    if (payment_mode === 'cash') {
      const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
      const newCash = (lastCash?.balance_after || 0) + amount;
      db.prepare('INSERT INTO cash_transactions (transaction_date, transaction_type, description, amount, balance_after, created_by) VALUES (?, "customer_payment", ?, ?, ?, ?)')
        .run(pDate, `Payment from ${customer.name}`, amount, newCash, req.user.id);
    }

    auditLog(req.user.id, req.user.username, 'CUSTOMER_PAYMENT', 'customers', req.params.id, null, { amount, payment_mode }, req.ip);
  });

  recordPayment();
  res.json({ message: 'Payment recorded successfully' });
});

// GET /api/customers/outstanding/all
router.get('/outstanding/all', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT c.id, c.name, c.mobile, c.credit_limit,
      COALESCE(SUM(s.credit_amount - s.paid_amount), 0) as outstanding,
      MAX(s.created_at) as last_sale_date
    FROM customers c JOIN sales s ON s.customer_id = c.id
    WHERE s.credit_amount > s.paid_amount AND s.status = 'completed'
    GROUP BY c.id ORDER BY outstanding DESC
  `).all();
  res.json(data);
});

module.exports = router;
