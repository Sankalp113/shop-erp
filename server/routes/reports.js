const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

function getDateRange(period, from, to) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'yesterday': {
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      return { from: y, to: y };
    }
    case 'this_week': {
      const day = now.getDay();
      const start = new Date(Date.now() - day * 86400000).toISOString().split('T')[0];
      return { from: start, to: today };
    }
    case 'this_month': return { from: today.substring(0, 7) + '-01', to: today };
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: d.toISOString().split('T')[0], to: end.toISOString().split('T')[0] };
    }
    case 'this_year': return { from: `${now.getFullYear()}-01-01`, to: today };
    case 'custom': return { from, to };
    default: return { from: today.substring(0, 7) + '-01', to: today };
  }
}

// GET /api/reports/sales
router.get('/sales', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const sales = db.prepare(`
    SELECT s.*, c.name as customer_name FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    ORDER BY s.created_at DESC
  `).all(from, to);
  const summary = db.prepare(`
    SELECT COUNT(*) as total_bills, SUM(total_amount) as total_sales,
      SUM(cash_amount) as cash, SUM(upi_amount) as upi,
      SUM(card_amount) as card, SUM(credit_amount) as credit,
      SUM(discount_amount) as total_discount, SUM(tax_amount) as total_tax
    FROM sales WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
  `).get(from, to);
  res.json({ data: sales, summary, period: { from, to } });
});

// GET /api/reports/purchase
router.get('/purchase', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const purchases = db.prepare(`
    SELECT p.*, v.name as vendor_name FROM purchases p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE date(p.purchase_date) BETWEEN ? AND ?
    ORDER BY p.purchase_date DESC
  `).all(from, to);
  const summary = db.prepare(`
    SELECT COUNT(*) as total_bills, SUM(total_amount) as total, SUM(paid_amount) as paid, SUM(outstanding_amount) as outstanding
    FROM purchases WHERE date(purchase_date) BETWEEN ? AND ?
  `).get(from, to);
  res.json({ data: purchases, summary, period: { from, to } });
});

// GET /api/reports/profit
router.get('/profit', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const profitBySale = db.prepare(`
    SELECT s.invoice_number, s.created_at, s.total_amount, s.discount_amount,
      SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity) as gross_profit,
      SUM(si.total_price) as revenue
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    GROUP BY s.id ORDER BY s.created_at DESC
  `).all(from, to);
  const summary = db.prepare(`
    SELECT 
      SUM(si.total_price) as total_revenue,
      SUM(si.purchase_price * si.quantity) as total_cost,
      SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity) as gross_profit
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
  `).get(from, to);
  const expenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) BETWEEN ? AND ?').get(from, to).total;
  const net_profit = (summary.gross_profit || 0) - expenses;
  res.json({ data: profitBySale, summary: { ...summary, expenses, net_profit }, period: { from, to } });
});

// GET /api/reports/profit-margin
router.get('/profit-margin', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const products = db.prepare(`
    SELECT si.product_name, si.product_id,
      SUM(si.quantity) as qty_sold,
      AVG(si.purchase_price) as avg_cost,
      AVG(si.unit_price) as avg_selling,
      SUM(si.total_price) as revenue,
      SUM(si.purchase_price * si.quantity) as cost,
      SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity) as profit,
      ROUND(SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity) * 100.0 / NULLIF(SUM(si.total_price), 0), 2) as margin_percent
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    GROUP BY si.product_name, si.product_id
    ORDER BY profit DESC
  `).all(from, to);
  res.json({ data: products, period: { from, to } });
});

// GET /api/reports/stock
router.get('/stock', (req, res) => {
  const db = getDb();
  const stock = db.prepare(`
    SELECT p.product_code, p.name, c.name as category, b.name as brand,
      p.purchase_price, p.selling_price,
      COALESCE(SUM(st.quantity), 0) as quantity,
      COALESCE(SUM(st.quantity), 0) * p.purchase_price as stock_value
    FROM products p
    LEFT JOIN stock st ON st.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.is_active = 1 GROUP BY p.id ORDER BY p.name
  `).all();
  const summary = db.prepare(`
    SELECT COUNT(*) as total_products, SUM(st.quantity * p.purchase_price) as total_value
    FROM products p LEFT JOIN stock st ON st.product_id = p.id WHERE p.is_active = 1
  `).get();
  res.json({ data: stock, summary });
});

// GET /api/reports/customer-ledger
router.get('/customer-ledger', (req, res) => {
  const db = getDb();
  const { customer_id, from, to } = req.query;
  let where = ['1=1'];
  let params = [];
  if (customer_id) { where.push('cl.customer_id = ?'); params.push(customer_id); }
  if (from) { where.push('date(cl.transaction_date) >= ?'); params.push(from); }
  if (to) { where.push('date(cl.transaction_date) <= ?'); params.push(to); }
  const ledger = db.prepare(`
    SELECT cl.*, c.name as customer_name, c.mobile FROM customer_ledger cl
    JOIN customers c ON cl.customer_id = c.id WHERE ${where.join(' AND ')} ORDER BY cl.id ASC
  `).all(...params);
  res.json(ledger);
});

// GET /api/reports/vendor-ledger
router.get('/vendor-ledger', (req, res) => {
  const db = getDb();
  const { vendor_id, from, to } = req.query;
  let where = ['1=1'];
  let params = [];
  if (vendor_id) { where.push('vl.vendor_id = ?'); params.push(vendor_id); }
  if (from) { where.push('date(vl.transaction_date) >= ?'); params.push(from); }
  if (to) { where.push('date(vl.transaction_date) <= ?'); params.push(to); }
  const ledger = db.prepare(`
    SELECT vl.*, v.name as vendor_name FROM vendor_ledger vl
    JOIN vendors v ON vl.vendor_id = v.id WHERE ${where.join(' AND ')} ORDER BY vl.id ASC
  `).all(...params);
  res.json(ledger);
});

// GET /api/reports/expenses
router.get('/expenses', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const expenses = db.prepare(`
    SELECT e.*, ec.name as category FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE date(e.expense_date) BETWEEN ? AND ? ORDER BY e.expense_date DESC
  `).all(from, to);
  const byCategory = db.prepare(`
    SELECT COALESCE(e.category_name, 'Other') as category, SUM(e.amount) as total
    FROM expenses e WHERE date(e.expense_date) BETWEEN ? AND ?
    GROUP BY e.category_name ORDER BY total DESC
  `).all(from, to);
  const total = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) BETWEEN ? AND ?').get(from, to);
  res.json({ data: expenses, by_category: byCategory, total: total.total, period: { from, to } });
});

// GET /api/reports/salary
router.get('/salary', (req, res) => {
  const db = getDb();
  const { month } = req.query;
  const m = month || new Date().toISOString().substring(0, 7);
  const salaries = db.prepare(`
    SELECT s.*, e.name as employee_name, e.employee_code, e.designation
    FROM salaries s JOIN employees e ON s.employee_id = e.id WHERE s.salary_month = ? ORDER BY e.name
  `).all(m);
  const summary = db.prepare('SELECT SUM(net_salary) as total, COUNT(*) as count FROM salaries WHERE salary_month = ?').get(m);
  res.json({ data: salaries, summary, month: m });
});

// GET /api/reports/cash-flow
router.get('/cash-flow', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const inflow = db.prepare("SELECT transaction_type, SUM(amount) as total FROM cash_transactions WHERE date(transaction_date) BETWEEN ? AND ? AND amount > 0 GROUP BY transaction_type").all(from, to);
  const outflow = db.prepare("SELECT transaction_type, SUM(ABS(amount)) as total FROM cash_transactions WHERE date(transaction_date) BETWEEN ? AND ? AND amount < 0 GROUP BY transaction_type").all(from, to);
  const daily = db.prepare("SELECT transaction_date, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as inflow, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as outflow FROM cash_transactions WHERE date(transaction_date) BETWEEN ? AND ? GROUP BY transaction_date ORDER BY transaction_date").all(from, to);
  res.json({ inflow, outflow, daily, period: { from, to } });
});

// GET /api/reports/credit-outstanding
router.get('/credit-outstanding', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT c.id, c.name, c.mobile, c.credit_limit,
      SUM(s.credit_amount - s.paid_amount) as outstanding,
      COUNT(s.id) as pending_bills,
      MIN(s.created_at) as oldest_credit_date,
      CAST(julianday('now') - julianday(MIN(s.created_at)) AS INTEGER) as days_outstanding
    FROM customers c JOIN sales s ON s.customer_id = c.id
    WHERE s.credit_amount > s.paid_amount AND s.status = 'completed'
    GROUP BY c.id ORDER BY outstanding DESC
  `).all();
  const total = db.prepare("SELECT COALESCE(SUM(credit_amount - paid_amount), 0) as total FROM sales WHERE credit_amount > paid_amount AND status = 'completed'").get();
  res.json({ data, total: total.total });
});

// GET /api/reports/product-performance
router.get('/product-performance', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const products = db.prepare(`
    SELECT si.product_id, si.product_name,
      SUM(si.quantity) as qty_sold,
      SUM(si.total_price) as revenue,
      SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity) as profit,
      COALESCE((SELECT SUM(st.quantity) FROM stock st WHERE st.product_id = si.product_id), 0) as current_stock
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC
  `).all(from, to);
  res.json({ data: products, period: { from, to } });
});

// GET /api/reports/category-performance
router.get('/category-performance', (req, res) => {
  const db = getDb();
  const { from, to } = getDateRange(req.query.period, req.query.from, req.query.to);
  const data = db.prepare(`
    SELECT COALESCE(c.name, 'Uncategorized') as category,
      SUM(si.quantity) as qty_sold,
      SUM(si.total_price) as revenue,
      SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity) as profit
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE date(s.created_at) BETWEEN ? AND ? AND s.status = 'completed'
    GROUP BY c.name ORDER BY revenue DESC
  `).all(from, to);
  res.json({ data, period: { from, to } });
});

// GET /api/reports/daily-summary
router.get('/daily-summary', (req, res) => {
  const db = getDb();
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];
  
  const sales = db.prepare("SELECT COUNT(*) as bills, COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(cash_amount), 0) as cash, COALESCE(SUM(upi_amount), 0) as upi, COALESCE(SUM(card_amount), 0) as card, COALESCE(SUM(credit_amount), 0) as credit FROM sales WHERE date(created_at) = ? AND status = 'completed'").get(d);
  const purchases = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE date(purchase_date) = ?").get(d);
  const expenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) = ?").get(d);
  const profit = db.prepare("SELECT COALESCE(SUM((si.unit_price * (1 - si.discount_percent/100.0) - si.purchase_price) * si.quantity), 0) as gross_profit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE date(s.created_at) = ? AND s.status = 'completed'").get(d);
  const returns = db.prepare("SELECT COALESCE(SUM(total_return_amount), 0) as total FROM sale_returns WHERE date(return_date) = ?").get(d);
  const newCustomers = db.prepare("SELECT COUNT(*) as count FROM customers WHERE date(created_at) = ?").get(d);
  const lowStock = db.prepare("SELECT COUNT(*) as count FROM (SELECT p.id, COALESCE(SUM(st.quantity), 0) as q, p.min_stock_level FROM products p LEFT JOIN stock st ON st.product_id = p.id WHERE p.is_active = 1 GROUP BY p.id HAVING q <= p.min_stock_level)").get();
  const customerOutstanding = db.prepare("SELECT COALESCE(SUM(credit_amount - paid_amount), 0) as total FROM sales WHERE credit_amount > paid_amount AND status = 'completed'").get();
  const vendorOutstanding = db.prepare("SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM purchases WHERE outstanding_amount > 0").get();

  res.json({
    date: d,
    total_sales: sales.total,
    bills: sales.bills,
    cash_sales: sales.cash,
    upi_sales: sales.upi,
    card_sales: sales.card,
    credit_sales: sales.credit,
    purchases: purchases.total,
    expenses: expenses.total,
    gross_profit: profit.gross_profit,
    returns: returns.total,
    new_customers: newCustomers.count,
    low_stock_items: lowStock.count,
    customer_outstanding: customerOutstanding.total,
    vendor_outstanding: vendorOutstanding.total,
  });
});

module.exports = router;
