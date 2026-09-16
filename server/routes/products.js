const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');
const { updateStock } = require('../services/stockService');

// GET /api/products
router.get('/', (req, res) => {
  const db = getDb();
  const { search, category_id, brand_id, is_active = 1, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let where = ['p.is_active = ?'];
  let params = [is_active];

  if (search) {
    where.push('(p.name LIKE ? OR p.product_code LIKE ? OR p.sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category_id) { where.push('p.category_id = ?'); params.push(category_id); }
  if (brand_id) { where.push('p.brand_id = ?'); params.push(brand_id); }

  const whereStr = where.join(' AND ');

  const products = db.prepare(`
    SELECT p.*, 
      c.name as category_name, b.name as brand_name, f.name as fabric_name,
      COALESCE((SELECT SUM(st.quantity) FROM stock st WHERE st.product_id = p.id), 0) as total_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN fabrics f ON p.fabric_id = f.id
    WHERE ${whereStr}
    ORDER BY p.name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) as count FROM products p WHERE ${whereStr}`).get(...params);

  res.json({ data: products, total: total.count, page: +page, limit: +limit });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, b.name as brand_name, f.name as fabric_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN fabrics f ON p.fabric_id = f.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const variants = db.prepare(`
    SELECT pv.*, s.name as size_name, cl.name as color_name, cl.hex_code,
      COALESCE((SELECT quantity FROM stock WHERE product_id = pv.product_id AND variant_id = pv.id), 0) as stock
    FROM product_variants pv
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN colors cl ON pv.color_id = cl.id
    WHERE pv.product_id = ? AND pv.is_active = 1
    ORDER BY s.sort_order, cl.name
  `).all(req.params.id);

  const stock = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total FROM stock WHERE product_id = ?
  `).get(req.params.id);

  res.json({ ...product, variants, total_stock: stock.total });
});

// POST /api/products
router.post('/', (req, res) => {
  const db = getDb();
  const {
    name, sku, category_id, brand_id, fabric_id, description,
    purchase_price, selling_price, mrp, discount_percent, tax_percent,
    min_stock_level, location, has_variants, opening_stock,
    variants
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required' });

  // Generate product code
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const product_code = `PRD${String(count + 1).padStart(5, '0')}`;

  const result = db.prepare(`
    INSERT INTO products (product_code, name, sku, category_id, brand_id, fabric_id, description,
      purchase_price, selling_price, mrp, discount_percent, tax_percent, min_stock_level, location, has_variants)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(product_code, name, sku || null, category_id || null, brand_id || null, fabric_id || null,
    description || null, purchase_price || 0, selling_price || 0, mrp || 0,
    discount_percent || 0, tax_percent || 0, min_stock_level || 5, location || null, has_variants ? 1 : 0);

  const productId = result.lastInsertRowid;

  // Handle variants
  if (has_variants && variants && variants.length > 0) {
    const insertVariant = db.prepare(`
      INSERT INTO product_variants (product_id, size_id, color_id, sku, barcode, purchase_price, selling_price, mrp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStock = db.prepare(`INSERT OR IGNORE INTO stock (product_id, variant_id, quantity) VALUES (?, ?, ?)`);
    
    variants.forEach(v => {
      const vResult = insertVariant.run(
        productId, v.size_id || null, v.color_id || null, v.sku || null, v.barcode || null,
        v.purchase_price || purchase_price || 0, v.selling_price || selling_price || 0, v.mrp || mrp || 0
      );
      insertStock.run(productId, vResult.lastInsertRowid, v.opening_stock || 0);
    });
  } else {
    // Simple product stock
    db.prepare(`INSERT OR IGNORE INTO stock (product_id, variant_id, quantity) VALUES (?, NULL, ?)`)
      .run(productId, opening_stock || 0);
  }

  auditLog(req.user.id, req.user.username, 'CREATE_PRODUCT', 'products', productId, null, { name, product_code }, req.ip);
  res.status(201).json({ id: productId, product_code, message: 'Product created successfully' });
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const old = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ error: 'Product not found' });

  const {
    name, sku, category_id, brand_id, fabric_id, description,
    purchase_price, selling_price, mrp, discount_percent, tax_percent,
    min_stock_level, location, is_active
  } = req.body;

  db.prepare(`
    UPDATE products SET name=?, sku=?, category_id=?, brand_id=?, fabric_id=?, description=?,
    purchase_price=?, selling_price=?, mrp=?, discount_percent=?, tax_percent=?,
    min_stock_level=?, location=?, is_active=?, updated_at=?
    WHERE id=?
  `).run(name || old.name, sku || old.sku, category_id || old.category_id,
    brand_id || old.brand_id, fabric_id || old.fabric_id, description || old.description,
    purchase_price ?? old.purchase_price, selling_price ?? old.selling_price,
    mrp ?? old.mrp, discount_percent ?? old.discount_percent, tax_percent ?? old.tax_percent,
    min_stock_level ?? old.min_stock_level, location || old.location,
    is_active !== undefined ? is_active : old.is_active, new Date().toISOString(), id);

  auditLog(req.user.id, req.user.username, 'UPDATE_PRODUCT', 'products', id, old, req.body, req.ip);
  res.json({ message: 'Product updated successfully' });
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), req.params.id);
  auditLog(req.user.id, req.user.username, 'DELETE_PRODUCT', 'products', req.params.id, null, null, req.ip);
  res.json({ message: 'Product deactivated' });
});

// GET /api/products/meta/categories
router.get('/meta/categories', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY name').all());
});

// GET /api/products/meta/brands
router.get('/meta/brands', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name').all());
});

// GET /api/products/meta/sizes
router.get('/meta/sizes', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM sizes WHERE is_active = 1 ORDER BY sort_order').all());
});

// GET /api/products/meta/colors
router.get('/meta/colors', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM colors WHERE is_active = 1 ORDER BY name').all());
});

// POST /api/products/meta/categories
router.post('/meta/categories', (req, res) => {
  const db = getDb();
  const { name, parent_id, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO categories (name, parent_id, description) VALUES (?, ?, ?)').run(name, parent_id || null, description || null);
  res.status(201).json({ id: r.lastInsertRowid, name });
});

// POST /api/products/meta/brands
router.post('/meta/brands', (req, res) => {
  const db = getDb();
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT OR IGNORE INTO brands (name, description) VALUES (?, ?)').run(name, description || null);
  res.status(201).json({ id: r.lastInsertRowid, name });
});

module.exports = router;
