const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');

// ── INVENTORY ──────────────────────────────────────────

// GET /api/inventory/stock
router.get('/stock', (req, res) => {
  const db = getDb();
  const { search, category_id, low_stock, page = 1, limit = 50 } = req.query;
  let where = ['p.is_active = 1'];
  let params = [];
  if (search) { where.push('(p.name LIKE ? OR p.product_code LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category_id) { where.push('p.category_id = ?'); params.push(category_id); }

  let having = [];
  if (low_stock === '1') having.push('total_stock <= p.min_stock_level');

  const stock = db.prepare(`
    SELECT p.id, p.product_code, p.name, p.min_stock_level, 
      c.name as category_name, b.name as brand_name,
      p.selling_price, p.purchase_price,
      COALESCE(SUM(st.quantity), 0) as total_stock
    FROM products p
    LEFT JOIN stock st ON st.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE ${where.join(' AND ')}
    GROUP BY p.id
    ${having.length ? 'HAVING ' + having.join(' AND ') : ''}
    ORDER BY p.name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);

  const total = db.prepare(`SELECT COUNT(*) as count FROM (
    SELECT p.id FROM products p LEFT JOIN stock st ON st.product_id = p.id
    WHERE ${where.join(' AND ')} GROUP BY p.id ${having.length ? 'HAVING ' + having.join(' AND ') : ''}
  )`).get(...params);

  res.json({ data: stock, total: total.count });
});

// GET /api/inventory/stock/:productId/variants
router.get('/stock/:productId/variants', (req, res) => {
  const db = getDb();
  const variants = db.prepare(`
    SELECT pv.*, s.name as size_name, c.name as color_name, c.hex_code,
      COALESCE(st.quantity, 0) as stock
    FROM product_variants pv
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN stock st ON st.variant_id = pv.id
    WHERE pv.product_id = ? AND pv.is_active = 1
    ORDER BY s.sort_order, c.name
  `).all(req.params.productId);
  res.json(variants);
});

// POST /api/inventory/adjustments
router.post('/adjustments', (req, res) => {
  const db = getDb();
  const { product_id, variant_id, adjustment_type, quantity_change, reason, notes } = req.body;
  if (!product_id || !quantity_change || !reason) return res.status(400).json({ error: 'product_id, quantity_change and reason are required' });

  const { updateStock } = require('../services/stockService');

  const doAdjust = db.transaction(() => {
    const { getStockLevel } = require('../services/stockService');
    const beforeQty = getStockLevel(product_id, variant_id || null);
    
    updateStock(product_id, variant_id || null, quantity_change, 'adjustment', 'adjustment', null, `${adjustment_type}: ${reason}`, req.user.id);
    
    const afterQty = getStockLevel(product_id, variant_id || null);
    
    const r = db.prepare(`
      INSERT INTO stock_adjustments (product_id, variant_id, adjustment_type, quantity_change, quantity_before, quantity_after, reason, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product_id, variant_id || null, adjustment_type, quantity_change, beforeQty, afterQty, reason, notes || null, req.user.id);

    auditLog(req.user.id, req.user.username, 'STOCK_ADJUSTMENT', 'inventory', r.lastInsertRowid, { quantity: beforeQty }, { quantity: afterQty, reason }, req.ip);
    return { id: r.lastInsertRowid, quantity_before: beforeQty, quantity_after: afterQty };
  });

  try {
    const result = doAdjust();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/inventory/adjustments
router.get('/adjustments', (req, res) => {
  const db = getDb();
  const { from, to, page = 1, limit = 50 } = req.query;
  let where = ['1=1'];
  let params = [];
  if (from) { where.push('date(sa.created_at) >= ?'); params.push(from); }
  if (to) { where.push('date(sa.created_at) <= ?'); params.push(to); }
  const adjustments = db.prepare(`
    SELECT sa.*, p.name as product_name, p.product_code,
      s.name as size_name, c.name as color_name, u.full_name as created_by_name
    FROM stock_adjustments sa
    JOIN products p ON sa.product_id = p.id
    LEFT JOIN product_variants pv ON sa.variant_id = pv.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN users u ON sa.created_by = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY sa.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM stock_adjustments sa WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: adjustments, total: total.count });
});

// GET /api/inventory/aging
router.get('/aging', (req, res) => {
  const db = getDb();
  const aging = db.prepare(`
    SELECT 
      p.id, p.product_code, p.name, p.selling_price,
      c.name as category_name, b.name as brand_name,
      COALESCE(SUM(st.quantity), 0) as stock,
      MAX(s.created_at) as last_sold_date,
      CAST(julianday('now') - julianday(COALESCE(MAX(s.created_at), p.created_at)) AS INTEGER) as age_days
    FROM products p
    LEFT JOIN stock st ON st.product_id = p.id
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING stock > 0
    ORDER BY age_days DESC
  `).all();

  const categorized = {
    '0_30': aging.filter(p => p.age_days <= 30),
    '31_60': aging.filter(p => p.age_days > 30 && p.age_days <= 60),
    '61_90': aging.filter(p => p.age_days > 60 && p.age_days <= 90),
    '91_180': aging.filter(p => p.age_days > 90 && p.age_days <= 180),
    '180_plus': aging.filter(p => p.age_days > 180),
  };

  res.json({ data: aging, categorized });
});

// GET /api/inventory/low-stock
router.get('/low-stock', (req, res) => {
  const db = getDb();
  const products = db.prepare(`
    SELECT p.id, p.product_code, p.name, p.min_stock_level, p.selling_price,
      c.name as category_name,
      COALESCE(SUM(st.quantity), 0) as total_stock
    FROM products p
    LEFT JOIN stock st ON st.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING total_stock <= p.min_stock_level
    ORDER BY total_stock ASC
  `).all();
  res.json(products);
});

// GET /api/inventory/transactions
router.get('/transactions', (req, res) => {
  const db = getDb();
  const { product_id, from, to, page = 1, limit = 50 } = req.query;
  let where = ['1=1'];
  let params = [];
  if (product_id) { where.push('st.product_id = ?'); params.push(product_id); }
  if (from) { where.push('date(st.created_at) >= ?'); params.push(from); }
  if (to) { where.push('date(st.created_at) <= ?'); params.push(to); }
  const txns = db.prepare(`
    SELECT st.*, p.name as product_name, p.product_code, u.full_name as created_by_name
    FROM stock_transactions st JOIN products p ON st.product_id = p.id
    LEFT JOIN users u ON st.created_by = u.id
    WHERE ${where.join(' AND ')} ORDER BY st.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM stock_transactions st WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: txns, total: total.count });
});

module.exports = router;
