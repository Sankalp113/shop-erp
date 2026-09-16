const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');
const { updateStock } = require('../services/stockService');

// Helper: Generate invoice number
function generateInvoiceNumber(db) {
  const prefix = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get()?.value || 'INV';
  const counter = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'invoice_counter'").get()?.value || '1');
  const invoiceNum = `${prefix}-${String(counter).padStart(5, '0')}`;
  db.prepare("UPDATE settings SET value = ? WHERE key = 'invoice_counter'").run(String(counter + 1));
  return invoiceNum;
}

// Helper: Update customer ledger
function updateCustomerLedger(db, customerId, transactionType, refType, refId, debit, credit, notes, transactionDate, createdBy) {
  const lastEntry = db.prepare('SELECT balance FROM customer_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(customerId);
  const prevBalance = lastEntry ? lastEntry.balance : 0;
  const newBalance = prevBalance + debit - credit;
  db.prepare(`
    INSERT INTO customer_ledger (customer_id, transaction_type, reference_type, reference_id, debit, credit, balance, notes, transaction_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customerId, transactionType, refType, refId, debit, credit, newBalance, notes, transactionDate, createdBy);
  return newBalance;
}

// GET /api/sales
router.get('/', (req, res) => {
  const db = getDb();
  const { from, to, customer_id, payment_mode, status, page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;

  let where = ['s.status != ?'];
  let params = ['deleted'];

  if (from) { where.push('date(s.created_at) >= ?'); params.push(from); }
  if (to) { where.push('date(s.created_at) <= ?'); params.push(to); }
  if (customer_id) { where.push('s.customer_id = ?'); params.push(customer_id); }
  if (payment_mode) { where.push('s.payment_mode = ?'); params.push(payment_mode); }
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (search) { where.push('(s.invoice_number LIKE ? OR s.customer_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const whereStr = where.join(' AND ');
  const sales = db.prepare(`
    SELECT s.*, c.mobile as customer_mobile_stored
    FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
    WHERE ${whereStr} ORDER BY s.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) as count FROM sales s WHERE ${whereStr}`).get(...params);
  const totals = db.prepare(`
    SELECT SUM(total_amount) as total_sales, SUM(cash_amount) as cash, 
           SUM(upi_amount) as upi, SUM(card_amount) as card, SUM(credit_amount) as credit
    FROM sales s WHERE ${whereStr}
  `).get(...params);

  res.json({ data: sales, total: total.count, page: +page, limit: +limit, totals });
});

// GET /api/sales/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const sale = db.prepare(`
    SELECT s.*, c.name as customer_name_stored, c.mobile, c.address
    FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ ...sale, items });
});

// POST /api/sales (New Sale)
router.post('/', (req, res) => {
  const db = getDb();
  const {
    customer_id, customer_name, customer_mobile,
    items, discount_amount = 0,
    cash_amount = 0, upi_amount = 0, card_amount = 0, credit_amount = 0,
    payment_mode = 'cash', notes, sale_date
  } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ error: 'No items in sale' });

  const createSale = db.transaction(() => {
    const invoice_number = generateInvoiceNumber(db);
    const saleDate = sale_date || new Date().toISOString().split('T')[0];

    // Calculate totals
    let subtotal = 0, tax_amount = 0;
    const processedItems = items.map(item => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);

      const itemDiscount = (item.unit_price * item.quantity) * (item.discount_percent || 0) / 100;
      const itemNet = (item.unit_price * item.quantity) - itemDiscount;
      const itemTax = itemNet * (item.tax_percent || 0) / 100;
      const itemTotal = itemNet + itemTax;

      subtotal += item.unit_price * item.quantity;
      tax_amount += itemTax;
      return { ...item, discount_amount: itemDiscount, tax_amount: itemTax, total_price: itemTotal, purchase_price: product.purchase_price };
    });

    const total_amount = subtotal - discount_amount + tax_amount;
    const paid_amount = cash_amount + upi_amount + card_amount;

    // Create sale record
    const saleResult = db.prepare(`
      INSERT INTO sales (invoice_number, sale_date, customer_id, customer_name, customer_mobile,
        subtotal, discount_amount, tax_amount, total_amount, paid_amount, credit_amount,
        payment_mode, cash_amount, upi_amount, card_amount, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `).run(invoice_number, saleDate, customer_id || null,
      customer_name || 'Walk-in Customer', customer_mobile || null,
      subtotal, discount_amount, tax_amount, total_amount, paid_amount, credit_amount,
      payment_mode, cash_amount, upi_amount, card_amount, notes || null, req.user.id);

    const saleId = saleResult.lastInsertRowid;

    // Insert items & deduct stock
    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, variant_id, product_name, size, color,
        quantity, unit_price, discount_percent, discount_amount, tax_percent, tax_amount, total_price, purchase_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    processedItems.forEach(item => {
      insertItem.run(saleId, item.product_id, item.variant_id || null, item.product_name,
        item.size || null, item.color || null, item.quantity, item.unit_price,
        item.discount_percent || 0, item.discount_amount, item.tax_percent || 0,
        item.tax_amount, item.total_price, item.purchase_price);
      
      // Deduct stock
      updateStock(item.product_id, item.variant_id || null, -item.quantity,
        'sale', 'sale', saleId, `Sale ${invoice_number}`, req.user.id);
    });

    // Update customer ledger if credit sale
    if (customer_id && credit_amount > 0) {
      updateCustomerLedger(db, customer_id, 'sale', 'sale', saleId, credit_amount, 0,
        `Credit sale - ${invoice_number}`, saleDate, req.user.id);
    }

    // Record cash transaction
    if (cash_amount > 0) {
      const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
      const newBalance = (lastCash?.balance_after || 0) + cash_amount;
      db.prepare(`INSERT INTO cash_transactions (transaction_date, transaction_type, reference_type, reference_id, description, amount, balance_after, created_by)
        VALUES (?, 'sale', 'sale', ?, ?, ?, ?, ?)`)
        .run(saleDate, saleId, `Sale ${invoice_number}`, cash_amount, newBalance, req.user.id);
    }

    auditLog(req.user.id, req.user.username, 'CREATE_SALE', 'sales', saleId, null, { invoice_number, total_amount }, req.ip);
    return { saleId, invoice_number, total_amount };
  });

  try {
    const result = createSale();
    res.status(201).json({ id: result.saleId, invoice_number: result.invoice_number, total_amount: result.total_amount, message: 'Sale created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/sales/:id/cancel
router.post('/:id/cancel', (req, res) => {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  if (sale.status === 'cancelled') return res.status(400).json({ error: 'Sale already cancelled' });

  const cancelSale = db.transaction(() => {
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('cancelled', sale.id);
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    items.forEach(item => {
      updateStock(item.product_id, item.variant_id, +item.quantity, 'return', 'sale', sale.id, `Sale cancelled - ${sale.invoice_number}`, req.user.id);
    });
    auditLog(req.user.id, req.user.username, 'CANCEL_SALE', 'sales', sale.id, { status: 'completed' }, { status: 'cancelled' }, req.ip);
  });

  cancelSale();
  res.json({ message: 'Sale cancelled successfully' });
});

// POST /api/sales/returns
router.post('/returns', (req, res) => {
  const db = getDb();
  const { original_sale_id, return_reason, refund_mode, items, notes } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items to return' });

  const processReturn = db.transaction(() => {
    const count = db.prepare('SELECT COUNT(*) as c FROM sale_returns').get().c;
    const return_number = `RET-${String(count + 1).padStart(5, '0')}`;
    const return_date = new Date().toISOString().split('T')[0];
    
    const total_return_amount = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    
    const rResult = db.prepare(`
      INSERT INTO sale_returns (return_number, original_sale_id, return_date, return_reason, total_return_amount, refund_mode, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(return_number, original_sale_id || null, return_date, return_reason || null, total_return_amount, refund_mode || 'cash', notes || null, req.user.id);

    const returnId = rResult.lastInsertRowid;

    items.forEach(item => {
      db.prepare(`INSERT INTO sale_return_items (return_id, sale_item_id, product_id, variant_id, product_name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(returnId, item.sale_item_id || null, item.product_id, item.variant_id || null, item.product_name, item.quantity, item.unit_price, item.quantity * item.unit_price);
      updateStock(item.product_id, item.variant_id || null, +item.quantity, 'return', 'sale_return', returnId, `Return ${return_number}`, req.user.id);
    });

    auditLog(req.user.id, req.user.username, 'CREATE_RETURN', 'sales', returnId, null, { return_number, total_return_amount }, req.ip);
    return { returnId, return_number, total_return_amount };
  });

  try {
    const result = processReturn();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/sales/returns/list
router.get('/returns/list', (req, res) => {
  const db = getDb();
  const { from, to, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  let where = ['1=1'];
  let params = [];
  if (from) { where.push('date(return_date) >= ?'); params.push(from); }
  if (to) { where.push('date(return_date) <= ?'); params.push(to); }
  const returns = db.prepare(`SELECT * FROM sale_returns WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM sale_returns WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: returns, total: total.count });
});

module.exports = router;
