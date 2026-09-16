const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');

// GET /api/vendors
router.get('/', (req, res) => {
  const db = getDb();
  const { search, is_active = 1, page = 1, limit = 50 } = req.query;
  let where = ['v.is_active = ?'];
  let params = [is_active];
  if (search) { where.push('(v.name LIKE ? OR v.mobile LIKE ? OR v.company_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const whereStr = where.join(' AND ');
  const vendors = db.prepare(`
    SELECT v.*,
      COALESCE((SELECT SUM(outstanding_amount) FROM purchases WHERE vendor_id = v.id), 0) as total_outstanding,
      COALESCE((SELECT SUM(total_amount) FROM purchases WHERE vendor_id = v.id), 0) as total_purchased
    FROM vendors v WHERE ${whereStr} ORDER BY v.name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM vendors v WHERE ${whereStr}`).get(...params);
  res.json({ data: vendors, total: total.count });
});

// GET /api/vendors/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  const ledger = db.prepare('SELECT * FROM vendor_ledger WHERE vendor_id = ? ORDER BY id DESC LIMIT 50').all(req.params.id);
  const outstanding = db.prepare('SELECT SUM(outstanding_amount) as total FROM purchases WHERE vendor_id = ?').get(req.params.id);
  res.json({ ...vendor, ledger, total_outstanding: outstanding.total || 0 });
});

// POST /api/vendors
router.post('/', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM vendors').get().c;
  const vendor_code = `VND${String(count + 1).padStart(4, '0')}`;
  const { name, company_name, contact_person, mobile, email, address, city, gstin, bank_name, bank_account, bank_ifsc, payment_terms, opening_balance, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Vendor name required' });
  const r = db.prepare(`INSERT INTO vendors (vendor_code, name, company_name, contact_person, mobile, email, address, city, gstin, bank_name, bank_account, bank_ifsc, payment_terms, opening_balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(vendor_code, name, company_name || null, contact_person || null, mobile || null, email || null, address || null, city || null, gstin || null, bank_name || null, bank_account || null, bank_ifsc || null, payment_terms || 30, opening_balance || 0, notes || null);
  
  // Opening balance ledger entry
  if (opening_balance > 0) {
    const lastEntry = db.prepare('SELECT balance FROM vendor_ledger WHERE vendor_id = ? ORDER BY id DESC LIMIT 1').get(r.lastInsertRowid);
    db.prepare('INSERT INTO vendor_ledger (vendor_id, transaction_type, debit, credit, balance, notes, transaction_date, created_by) VALUES (?, ?, ?, 0, ?, ?, ?, ?)')
      .run(r.lastInsertRowid, 'opening', opening_balance, opening_balance, 'Opening balance', new Date().toISOString().split('T')[0], req.user.id);
  }

  auditLog(req.user.id, req.user.username, 'CREATE_VENDOR', 'vendors', r.lastInsertRowid, null, { name, vendor_code }, req.ip);
  res.status(201).json({ id: r.lastInsertRowid, vendor_code });
});

// PUT /api/vendors/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Vendor not found' });
  const { name, company_name, contact_person, mobile, email, address, city, gstin, bank_name, bank_account, bank_ifsc, payment_terms, notes, is_active } = req.body;
  db.prepare(`UPDATE vendors SET name=?, company_name=?, contact_person=?, mobile=?, email=?, address=?, city=?, gstin=?, bank_name=?, bank_account=?, bank_ifsc=?, payment_terms=?, notes=?, is_active=?, updated_at=? WHERE id=?`)
    .run(name || old.name, company_name, contact_person, mobile, email, address, city, gstin, bank_name, bank_account, bank_ifsc, payment_terms || old.payment_terms, notes, is_active !== undefined ? is_active : old.is_active, new Date().toISOString(), req.params.id);
  auditLog(req.user.id, req.user.username, 'UPDATE_VENDOR', 'vendors', req.params.id, old, req.body, req.ip);
  res.json({ message: 'Vendor updated' });
});

// GET /api/vendors/:id/ledger
router.get('/:id/ledger', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 50 } = req.query;
  const ledger = db.prepare('SELECT * FROM vendor_ledger WHERE vendor_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(req.params.id, limit, (page-1)*limit);
  const total = db.prepare('SELECT COUNT(*) as count FROM vendor_ledger WHERE vendor_id = ?').get(req.params.id);
  res.json({ data: ledger, total: total.count });
});

// GET /api/vendors/outstanding/all
router.get('/outstanding/all', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT v.id, v.name, v.mobile, SUM(p.outstanding_amount) as outstanding, MIN(p.due_date) as earliest_due
    FROM vendors v JOIN purchases p ON p.vendor_id = v.id
    WHERE p.outstanding_amount > 0
    GROUP BY v.id ORDER BY outstanding DESC
  `).all();
  res.json(data);
});

module.exports = router;
