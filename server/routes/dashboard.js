const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

// GET /api/dashboard/summary
router.get('/summary', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  // Today's sales
  const todaySales = db.prepare(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as total_sales,
      COUNT(*) as total_bills,
      COALESCE(SUM(cash_amount), 0) as cash_sales,
      COALESCE(SUM(upi_amount), 0) as upi_sales,
      COALESCE(SUM(card_amount), 0) as card_sales,
      COALESCE(SUM(credit_amount), 0) as credit_sales
    FROM sales WHERE date(created_at) = ? AND status = 'completed'
  `).get(today);

  // Today's purchases
  const todayPurchases = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE date(purchase_date) = ?
  `).get(today);

  // Today's expenses
  const todayExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(expense_date) = ?
  `).get(today);

  // Customer outstanding
  const customerOutstanding = db.prepare(`
    SELECT COALESCE(SUM(credit_amount - paid_amount), 0) as total 
    FROM sales WHERE credit_amount > paid_amount AND status = 'completed'
  `).get();

  // Vendor outstanding
  const vendorOutstanding = db.prepare(`
    SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM purchases WHERE outstanding_amount > 0
  `).get();

  // Cash balance (last cash transaction balance)
  const cashBalance = db.prepare(`
    SELECT COALESCE(balance_after, 0) as balance FROM cash_transactions ORDER BY id DESC LIMIT 1
  `).get();

  // Gross profit today
  const profitData = db.prepare(`
    SELECT 
      COALESCE(SUM((si.unit_price * (1 - si.discount_percent/100) - si.purchase_price) * si.quantity), 0) as gross_profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) = ? AND s.status = 'completed'
  `).get(today);

  // Monthly stats
  const monthSales = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM sales 
    WHERE date(created_at) >= ? AND status = 'completed'
  `).get(monthStart);

  // Low stock count
  const lowStock = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT p.id, p.name, p.min_stock_level,
        COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id), 0) as total_stock
      FROM products p WHERE p.is_active = 1
    ) WHERE total_stock <= min_stock_level AND total_stock >= 0
  `).get();

  // Today's new customers
  const newCustomers = db.prepare(`
    SELECT COUNT(*) as count FROM customers WHERE date(created_at) = ?
  `).get(today);

  // Today's returns
  const todayReturns = db.prepare(`
    SELECT COALESCE(SUM(total_return_amount), 0) as total FROM sale_returns WHERE date(return_date) = ?
  `).get(today);

  res.json({
    today: {
      ...todaySales,
      purchases: todayPurchases.total,
      expenses: todayExpenses.total,
      gross_profit: profitData.gross_profit,
      returns: todayReturns.total,
      new_customers: newCustomers.count,
    },
    balances: {
      cash: cashBalance?.balance || 0,
      customer_outstanding: customerOutstanding.total,
      vendor_outstanding: vendorOutstanding.total,
    },
    month: {
      total_sales: monthSales.total,
    },
    alerts: {
      low_stock_count: lowStock.count,
    }
  });
});

// GET /api/dashboard/alerts
router.get('/alerts', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Low stock products
  const lowStockProducts = db.prepare(`
    SELECT p.id, p.name, p.min_stock_level,
      COALESCE(SUM(st.quantity), 0) as total_stock
    FROM products p
    LEFT JOIN stock st ON st.product_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING total_stock <= p.min_stock_level
    ORDER BY total_stock ASC LIMIT 10
  `).all();

  // Vendor payments due
  const vendorDue = db.prepare(`
    SELECT p.id, v.name as vendor_name, p.outstanding_amount, p.due_date,
      CASE 
        WHEN p.due_date < ? THEN 'overdue'
        WHEN p.due_date <= ? THEN 'due_soon'
        ELSE 'upcoming'
      END as urgency
    FROM purchases p JOIN vendors v ON p.vendor_id = v.id
    WHERE p.outstanding_amount > 0 AND p.due_date IS NOT NULL
    ORDER BY p.due_date ASC LIMIT 10
  `).all(today, in7Days);

  // Customer credit dues (overdue > 30 days)
  const customerDue = db.prepare(`
    SELECT c.id, c.name, c.mobile,
      SUM(s.credit_amount - s.paid_amount) as outstanding
    FROM sales s JOIN customers c ON s.customer_id = c.id
    WHERE s.credit_amount > s.paid_amount AND s.status = 'completed'
    GROUP BY c.id ORDER BY outstanding DESC LIMIT 10
  `).all();

  // Electricity due
  const electricityDue = db.prepare(`
    SELECT id, bill_amount, due_date, status
    FROM electricity_bills WHERE status != 'paid' ORDER BY due_date ASC LIMIT 5
  `).all();

  // Rent due
  const rentDue = db.prepare(`
    SELECT id, amount, due_date, status FROM rent_payments
    WHERE status != 'paid' ORDER BY due_date ASC LIMIT 5
  `).all();

  // Salary due (this month)
  const salaryDue = db.prepare(`
    SELECT COUNT(*) as count, SUM(net_salary) as total_amount
    FROM salaries WHERE status = 'pending' AND salary_month = strftime('%Y-%m', 'now')
  `).get();

  // Old/slow stock (90+ days not sold)
  const slowStock = db.prepare(`
    SELECT p.id, p.name,
      COALESCE(SUM(st.quantity), 0) as stock,
      MAX(s.created_at) as last_sale
    FROM products p
    LEFT JOIN stock st ON st.product_id = p.id
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING (last_sale IS NULL OR julianday('now') - julianday(last_sale) > 90) AND stock > 0
    ORDER BY last_sale ASC NULLS FIRST LIMIT 10
  `).all();

  res.json({
    low_stock: lowStockProducts,
    vendor_payments_due: vendorDue,
    customer_payments_due: customerDue,
    electricity_due: electricityDue,
    rent_due: rentDue,
    salary_due: salaryDue,
    slow_moving_stock: slowStock,
  });
});

// GET /api/dashboard/charts
router.get('/charts', (req, res) => {
  const db = getDb();
  
  // Sales last 7 days
  const sales7Days = db.prepare(`
    SELECT date(created_at) as date, SUM(total_amount) as total
    FROM sales WHERE date(created_at) >= date('now', '-6 days') AND status = 'completed'
    GROUP BY date(created_at) ORDER BY date ASC
  `).all();

  // Top 5 products this month
  const topProducts = db.prepare(`
    SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.total_price) as revenue
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE date(s.created_at) >= date('now', 'start of month') AND s.status = 'completed'
    GROUP BY si.product_name ORDER BY qty_sold DESC LIMIT 5
  `).all();

  // Monthly sales last 6 months
  const monthlySales = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, SUM(total_amount) as total
    FROM sales WHERE status = 'completed' AND created_at >= date('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  // Payment mode breakdown (today)
  const paymentModes = db.prepare(`
    SELECT 
      SUM(cash_amount) as cash,
      SUM(upi_amount) as upi,
      SUM(card_amount) as card,
      SUM(credit_amount) as credit
    FROM sales WHERE date(created_at) = date('now') AND status = 'completed'
  `).get();

  res.json({ sales7Days, topProducts, monthlySales, paymentModes });
});

module.exports = router;
