const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

// GET /api/finance/cash
router.get('/cash', (req, res) => {
  const db = getDb();
  const { from, to, page = 1, limit = 100 } = req.query;
  let where = ['1=1'];
  let params = [];
  if (from) { where.push('date(t.transaction_date) >= ?'); params.push(from); }
  if (to) { where.push('date(t.transaction_date) <= ?'); params.push(to); }
  const txns = db.prepare(`
    SELECT t.*, u.full_name as created_by_name FROM cash_transactions t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE ${where.join(' AND ')} ORDER BY t.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const balance = db.prepare('SELECT COALESCE(balance_after, 0) as balance FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
  const total = db.prepare(`SELECT COUNT(*) as count FROM cash_transactions t WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: txns, total: total.count, current_balance: balance?.balance || 0 });
});

// POST /api/finance/cash (manual entry)
router.post('/cash', (req, res) => {
  const db = getDb();
  const { transaction_date, transaction_type, description, amount } = req.body;
  if (!description || !amount) return res.status(400).json({ error: 'Description and amount required' });
  const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
  const newBalance = (lastCash?.balance_after || 0) + amount;
  const r = db.prepare('INSERT INTO cash_transactions (transaction_date, transaction_type, description, amount, balance_after, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(transaction_date || new Date().toISOString().split('T')[0], transaction_type || 'other', description, amount, newBalance, req.user.id);
  res.status(201).json({ id: r.lastInsertRowid, balance: newBalance });
});

// GET /api/finance/bank/accounts
router.get('/bank/accounts', (req, res) => {
  const db = getDb();
  const accounts = db.prepare('SELECT * FROM bank_accounts WHERE is_active = 1').all();
  const accountsWithBalance = accounts.map(acc => {
    const lastTxn = db.prepare('SELECT balance_after FROM bank_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1').get(acc.id);
    return { ...acc, current_balance: lastTxn?.balance_after ?? acc.opening_balance };
  });
  res.json(accountsWithBalance);
});

// POST /api/finance/bank/accounts
router.post('/bank/accounts', (req, res) => {
  const db = getDb();
  const { account_name, bank_name, account_number, ifsc_code, opening_balance } = req.body;
  const r = db.prepare('INSERT INTO bank_accounts (account_name, bank_name, account_number, ifsc_code, opening_balance) VALUES (?, ?, ?, ?, ?)')
    .run(account_name, bank_name, account_number || null, ifsc_code || null, opening_balance || 0);
  res.status(201).json({ id: r.lastInsertRowid });
});

// GET /api/finance/bank/:accountId/transactions
router.get('/bank/:accountId/transactions', (req, res) => {
  const db = getDb();
  const { from, to, page = 1, limit = 100 } = req.query;
  let where = ['t.account_id = ?'];
  let params = [req.params.accountId];
  if (from) { where.push('date(t.transaction_date) >= ?'); params.push(from); }
  if (to) { where.push('date(t.transaction_date) <= ?'); params.push(to); }
  const txns = db.prepare(`SELECT t.* FROM bank_transactions t WHERE ${where.join(' AND ')} ORDER BY t.id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page-1)*limit);
  const balance = db.prepare('SELECT COALESCE(balance_after, 0) as balance FROM bank_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1').get(req.params.accountId);
  res.json({ data: txns, current_balance: balance?.balance || 0 });
});

// POST /api/finance/bank/:accountId/transactions
router.post('/bank/:accountId/transactions', (req, res) => {
  const db = getDb();
  const { transaction_date, transaction_type, description, amount, reference_number } = req.body;
  const lastTxn = db.prepare('SELECT balance_after FROM bank_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1').get(req.params.accountId);
  const acc = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.accountId);
  const currentBalance = lastTxn?.balance_after ?? acc?.opening_balance ?? 0;
  const newBalance = currentBalance + amount;
  const r = db.prepare('INSERT INTO bank_transactions (account_id, transaction_date, transaction_type, description, amount, balance_after, reference_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.accountId, transaction_date || new Date().toISOString().split('T')[0], transaction_type || 'deposit', description, amount, newBalance, reference_number || null, req.user.id);
  res.status(201).json({ id: r.lastInsertRowid, balance: newBalance });
});

// GET /api/finance/summary
router.get('/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';
  
  const cashBalance = db.prepare('SELECT COALESCE(balance_after, 0) as b FROM cash_transactions ORDER BY id DESC LIMIT 1').get()?.b || 0;
  const bankAccounts = db.prepare('SELECT * FROM bank_accounts WHERE is_active = 1').all();
  const totalBank = bankAccounts.reduce((sum, acc) => {
    const lastTxn = db.prepare('SELECT balance_after FROM bank_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1').get(acc.id);
    return sum + (lastTxn?.balance_after ?? acc.opening_balance ?? 0);
  }, 0);

  const monthExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) >= ?").get(monthStart);
  const customerReceivable = db.prepare("SELECT COALESCE(SUM(credit_amount - paid_amount), 0) as total FROM sales WHERE credit_amount > paid_amount AND status = 'completed'").get();
  const vendorPayable = db.prepare("SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM purchases WHERE outstanding_amount > 0").get();

  res.json({
    cash_balance: cashBalance,
    total_bank: totalBank,
    total_liquid: cashBalance + totalBank,
    customer_receivable: customerReceivable.total,
    vendor_payable: vendorPayable.total,
    month_expenses: monthExpenses.total,
    bank_accounts: bankAccounts.map(acc => {
      const lastTxn = db.prepare('SELECT balance_after FROM bank_transactions WHERE account_id = ? ORDER BY id DESC LIMIT 1').get(acc.id);
      return { ...acc, current_balance: lastTxn?.balance_after ?? acc.opening_balance };
    }),
  });
});

// GET /api/finance/reconciliation
router.get('/reconciliation', (req, res) => {
  const db = getDb();
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];

  const openingCash = db.prepare("SELECT COALESCE(balance_after, 0) as b FROM cash_transactions WHERE date(transaction_date) < ? ORDER BY id DESC LIMIT 1").get(d)?.b || 0;
  const receipts = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE date(transaction_date) = ? AND amount > 0").get(d).total;
  const payments = db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM cash_transactions WHERE date(transaction_date) = ? AND amount < 0").get(d).total;
  const expectedClosing = openingCash + receipts - payments;

  res.json({ date: d, opening_cash: openingCash, receipts, payments, expected_closing: expectedClosing });
});

module.exports = router;
