const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

router.get('/', (req, res) => {
  const db = getDb();
  const { module, action, user_id, from, to, page = 1, limit = 100 } = req.query;
  let where = ['1=1'];
  let params = [];
  if (module) { where.push('al.module = ?'); params.push(module); }
  if (action) { where.push('al.action = ?'); params.push(action); }
  if (user_id) { where.push('al.user_id = ?'); params.push(user_id); }
  if (from) { where.push('date(al.created_at) >= ?'); params.push(from); }
  if (to) { where.push('date(al.created_at) <= ?'); params.push(to); }

  const logs = db.prepare(`
    SELECT al.* FROM audit_logs al
    WHERE ${where.join(' AND ')} ORDER BY al.id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs al WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: logs, total: total.count });
});

module.exports = router;
