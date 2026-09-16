const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');

// GET /api/reminders
router.get('/', (req, res) => {
  const db = getDb();
  const { status, type, page = 1, limit = 50 } = req.query;
  const today = new Date().toISOString().split('T')[0];
  
  let where = ['1=1'];
  let params = [];
  if (status) { where.push('r.status = ?'); params.push(status); }
  else { where.push("r.status = 'pending'"); }
  if (type) { where.push('r.reminder_type = ?'); params.push(type); }

  const reminders = db.prepare(`
    SELECT r.*,
      CASE 
        WHEN r.due_date < ? THEN 'overdue'
        WHEN r.due_date = ? THEN 'due_today'
        WHEN r.due_date <= date(?, '+3 days') THEN 'due_soon'
        ELSE 'upcoming'
      END as urgency
    FROM reminders r WHERE ${where.join(' AND ')}
    ORDER BY r.due_date ASC LIMIT ? OFFSET ?
  `).all(today, today, today, ...params, limit, (page-1)*limit);

  const counts = db.prepare(`
    SELECT
      COUNT(CASE WHEN due_date < ? AND status = 'pending' THEN 1 END) as overdue,
      COUNT(CASE WHEN due_date = ? AND status = 'pending' THEN 1 END) as due_today,
      COUNT(CASE WHEN due_date > ? AND due_date <= date(?, '+7 days') AND status = 'pending' THEN 1 END) as due_week,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as total_pending
    FROM reminders
  `).get(today, today, today, today);

  res.json({ data: reminders, counts });
});

// POST /api/reminders
router.post('/', (req, res) => {
  const db = getDb();
  const { reminder_type, title, description, due_date, amount, priority } = req.body;
  if (!title || !due_date) return res.status(400).json({ error: 'title and due_date required' });
  const r = db.prepare('INSERT INTO reminders (reminder_type, title, description, due_date, amount, priority) VALUES (?, ?, ?, ?, ?, ?)')
    .run(reminder_type || 'custom', title, description || null, due_date, amount || null, priority || 'normal');
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /api/reminders/:id/complete
router.put('/:id/complete', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE reminders SET status = 'completed', completed_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.json({ message: 'Reminder completed' });
});

// PUT /api/reminders/:id/dismiss
router.put('/:id/dismiss', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE reminders SET status = 'dismissed' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Reminder dismissed' });
});

// GET /api/reminders/notifications
router.get('/notifications', (req, res) => {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE (user_id = ? OR user_id IS NULL) ORDER BY id DESC LIMIT 30
  `).all(req.user.id);
  const unreadCount = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0").get(req.user.id);
  res.json({ data: notifications, unread_count: unreadCount.count });
});

// PUT /api/reminders/notifications/read-all
router.put('/notifications/read-all', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL").run(req.user.id);
  res.json({ message: 'All notifications marked read' });
});

module.exports = router;
