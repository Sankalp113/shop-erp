const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');

// ─── MISC EXPENSES ────────────────────────────────────

router.get('/', (req, res) => {
  const db = getDb();
  const { from, to, category_id, page = 1, limit = 50 } = req.query;
  let where = ['1=1'];
  let params = [];
  if (from) { where.push('date(e.expense_date) >= ?'); params.push(from); }
  if (to) { where.push('date(e.expense_date) <= ?'); params.push(to); }
  if (category_id) { where.push('e.category_id = ?'); params.push(category_id); }
  const whereStr = where.join(' AND ');
  const expenses = db.prepare(`
    SELECT e.*, ec.name as category_name, u.full_name as created_by_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    LEFT JOIN users u ON e.created_by = u.id
    WHERE ${whereStr} ORDER BY e.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM expenses e WHERE ${whereStr}`).get(...params);
  res.json({ data: expenses, total: total.count, total_amount: total.total_amount });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { expense_date, category_id, description, amount, payment_mode, vendor_person, notes } = req.body;
  if (!description || !amount) return res.status(400).json({ error: 'Description and amount required' });
  
  const catName = category_id ? db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(category_id)?.name : null;
  const r = db.prepare(`INSERT INTO expenses (expense_date, category_id, category_name, description, amount, payment_mode, vendor_person, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(expense_date || new Date().toISOString().split('T')[0], category_id || null, catName, description, amount, payment_mode || 'cash', vendor_person || null, notes || null, req.user.id);
  
  if (!payment_mode || payment_mode === 'cash') {
    const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
    const newBalance = (lastCash?.balance_after || 0) - amount;
    db.prepare('INSERT INTO cash_transactions (transaction_date, transaction_type, description, amount, balance_after, created_by) VALUES (?, "expense", ?, ?, ?, ?)')
      .run(expense_date || new Date().toISOString().split('T')[0], description, -amount, newBalance, req.user.id);
  }

  auditLog(req.user.id, req.user.username, 'CREATE_EXPENSE', 'expenses', r.lastInsertRowid, null, { description, amount }, req.ip);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.get('/categories', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name').all());
});

router.post('/categories', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT OR IGNORE INTO expense_categories (name) VALUES (?)').run(name);
  res.status(201).json({ id: r.lastInsertRowid, name });
});

// ─── ELECTRICITY BILLS ────────────────────────────────

router.get('/electricity', (req, res) => {
  const db = getDb();
  const bills = db.prepare('SELECT * FROM electricity_bills ORDER BY id DESC').all();
  res.json(bills);
});

router.post('/electricity', (req, res) => {
  const db = getDb();
  const { consumer_number, meter_number, bill_date, billing_period_start, billing_period_end, previous_reading, current_reading, units_consumed, bill_amount, due_date, notes } = req.body;
  if (!bill_amount || !due_date) return res.status(400).json({ error: 'bill_amount and due_date required' });
  const r = db.prepare(`INSERT INTO electricity_bills (consumer_number, meter_number, bill_date, billing_period_start, billing_period_end, previous_reading, current_reading, units_consumed, bill_amount, due_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(consumer_number || null, meter_number || null, bill_date || new Date().toISOString().split('T')[0], billing_period_start || null, billing_period_end || null, previous_reading || 0, current_reading || 0, units_consumed || 0, bill_amount, due_date, notes || null, req.user.id);
  
  db.prepare(`INSERT INTO reminders (reminder_type, reference_type, reference_id, title, amount, due_date, priority) VALUES ('electricity', 'electricity_bill', ?, 'Electricity Bill Due', ?, ?, 'high')`)
    .run(r.lastInsertRowid, bill_amount, due_date);
  
  res.status(201).json({ id: r.lastInsertRowid });
});

router.post('/electricity/:id/pay', (req, res) => {
  const db = getDb();
  const { payment_date, payment_mode } = req.body;
  const bill = db.prepare('SELECT * FROM electricity_bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  
  const pDate = payment_date || new Date().toISOString().split('T')[0];
  db.prepare('UPDATE electricity_bills SET status = "paid", payment_date = ?, payment_mode = ? WHERE id = ?').run(pDate, payment_mode || 'cash', req.params.id);
  db.prepare("UPDATE reminders SET status = 'completed', completed_at = ? WHERE reference_type = 'electricity_bill' AND reference_id = ?").run(new Date().toISOString(), req.params.id);
  
  const cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'Electricity'").get();
  db.prepare('INSERT INTO expenses (expense_date, category_id, category_name, description, amount, payment_mode, created_by) VALUES (?, ?, "Electricity", "Electricity Bill Payment", ?, ?, ?)').run(pDate, cat?.id, bill.bill_amount, payment_mode || 'cash', req.user.id);
  
  res.json({ message: 'Electricity bill marked as paid' });
});

// ─── RENT PAYMENTS ────────────────────────────────────

router.get('/rent', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM rent_payments ORDER BY id DESC').all());
});

router.post('/rent', (req, res) => {
  const db = getDb();
  const { rent_type, period_start, period_end, amount, due_date, landlord_name, notes } = req.body;
  if (!amount || !due_date) return res.status(400).json({ error: 'amount and due_date required' });
  const r = db.prepare(`INSERT INTO rent_payments (rent_type, period_start, period_end, amount, due_date, landlord_name, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(rent_type || 'monthly', period_start || null, period_end || null, amount, due_date, landlord_name || null, notes || null, req.user.id);
  
  db.prepare(`INSERT INTO reminders (reminder_type, reference_type, reference_id, title, amount, due_date, priority) VALUES ('rent', 'rent_payment', ?, 'Shop Rent Due', ?, ?, 'high')`)
    .run(r.lastInsertRowid, amount, due_date);

  res.status(201).json({ id: r.lastInsertRowid });
});

router.post('/rent/:id/pay', (req, res) => {
  const db = getDb();
  const { payment_date, payment_mode } = req.body;
  const rent = db.prepare('SELECT * FROM rent_payments WHERE id = ?').get(req.params.id);
  if (!rent) return res.status(404).json({ error: 'Not found' });
  
  const pDate = payment_date || new Date().toISOString().split('T')[0];
  db.prepare('UPDATE rent_payments SET status = "paid", payment_date = ?, payment_mode = ? WHERE id = ?').run(pDate, payment_mode || 'cash', req.params.id);
  db.prepare("UPDATE reminders SET status = 'completed', completed_at = ? WHERE reference_type = 'rent_payment' AND reference_id = ?").run(new Date().toISOString(), req.params.id);

  const cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'Rent'").get();
  db.prepare('INSERT INTO expenses (expense_date, category_id, category_name, description, amount, payment_mode, created_by) VALUES (?, ?, "Rent", "Shop Rent Payment", ?, ?, ?)').run(pDate, cat?.id, rent.amount, payment_mode || 'cash', req.user.id);
  
  res.json({ message: 'Rent marked as paid' });
});

// ─── RECURRING EXPENSES ───────────────────────────────

router.get('/recurring', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT r.*, ec.name as category_name FROM recurring_expenses r LEFT JOIN expense_categories ec ON r.category_id = ec.id WHERE r.is_active = 1 ORDER BY r.next_due_date ASC').all());
});

router.post('/recurring', (req, res) => {
  const db = getDb();
  const { name, category_id, amount, frequency, next_due_date, payment_mode, vendor_person, notes } = req.body;
  if (!name || !amount || !frequency || !next_due_date) return res.status(400).json({ error: 'name, amount, frequency, next_due_date required' });
  const r = db.prepare(`INSERT INTO recurring_expenses (name, category_id, amount, frequency, next_due_date, payment_mode, vendor_person, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, category_id || null, amount, frequency, next_due_date, payment_mode || null, vendor_person || null, notes || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/recurring/:id', (req, res) => {
  const db = getDb();
  const { name, amount, frequency, next_due_date, is_active, notes } = req.body;
  db.prepare('UPDATE recurring_expenses SET name=?, amount=?, frequency=?, next_due_date=?, is_active=?, notes=? WHERE id=?')
    .run(name, amount, frequency, next_due_date, is_active !== undefined ? is_active : 1, notes, req.params.id);
  res.json({ message: 'Updated' });
});

module.exports = router;
