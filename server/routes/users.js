const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');
const { requireRole } = require('../middleware/auth');

// GET /api/users
router.get('/', requireRole('owner'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT u.id, u.username, u.full_name, u.email, u.mobile, u.is_active, u.last_login, u.created_at, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.full_name').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireRole('owner'), (req, res) => {
  const db = getDb();
  const { username, password, full_name, email, mobile, role_name } = req.body;
  if (!username || !password || !full_name || !role_name) return res.status(400).json({ error: 'username, password, full_name, role_name required' });
  const role = db.prepare('SELECT * FROM roles WHERE name = ?').get(role_name);
  if (!role) return res.status(400).json({ error: 'Invalid role' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const r = db.prepare('INSERT INTO users (username, password_hash, full_name, email, mobile, role_id) VALUES (?, ?, ?, ?, ?, ?)').run(username.toLowerCase(), hash, full_name, email || null, mobile || null, role.id);
    auditLog(req.user.id, req.user.username, 'CREATE_USER', 'users', r.lastInsertRowid, null, { username, role_name }, req.ip);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    throw e;
  }
});

// PUT /api/users/:id
router.put('/:id', requireRole('owner'), (req, res) => {
  const db = getDb();
  const { full_name, email, mobile, role_name, is_active, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  let role_id = user.role_id;
  if (role_name) {
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(role_name);
    if (role) role_id = role.id;
  }

  let hash = user.password_hash;
  if (password) hash = bcrypt.hashSync(password, 10);

  db.prepare('UPDATE users SET full_name=?, email=?, mobile=?, role_id=?, is_active=?, password_hash=?, updated_at=? WHERE id=?')
    .run(full_name || user.full_name, email, mobile, role_id, is_active !== undefined ? is_active : user.is_active, hash, new Date().toISOString(), req.params.id);
  
  auditLog(req.user.id, req.user.username, 'UPDATE_USER', 'users', req.params.id, user, req.body, req.ip);
  res.json({ message: 'User updated' });
});

// GET /api/users/roles
router.get('/roles', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM roles ORDER BY name').all());
});

module.exports = router;
