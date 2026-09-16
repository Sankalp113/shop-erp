const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

router.get('/', (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  settings.forEach(s => obj[s.key] = s.value);
  res.json(obj);
});

router.put('/', (req, res) => {
  const db = getDb();
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  const updateMany = db.transaction(() => {
    Object.entries(req.body).forEach(([key, value]) => {
      update.run(key, String(value), new Date().toISOString());
    });
  });
  updateMany();
  res.json({ message: 'Settings saved' });
});

module.exports = router;
