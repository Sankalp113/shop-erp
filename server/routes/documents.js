const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../models/database');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.get('/', (req, res) => {
  const db = getDb();
  const { document_type, reference_type, reference_id, search } = req.query;
  let where = ['1=1'];
  let params = [];
  if (document_type) { where.push('d.document_type = ?'); params.push(document_type); }
  if (reference_type) { where.push('d.reference_type = ?'); params.push(reference_type); }
  if (reference_id) { where.push('d.reference_id = ?'); params.push(reference_id); }
  if (search) { where.push('(d.title LIKE ? OR d.tags LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const docs = db.prepare(`
    SELECT d.*, u.full_name as uploaded_by_name FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE ${where.join(' AND ')} ORDER BY d.id DESC
  `).all(...params);
  res.json(docs);
});

router.post('/upload', upload.single('file'), (req, res) => {
  const db = getDb();
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { document_type, reference_type, reference_id, title, tags, notes } = req.body;
  const r = db.prepare(`INSERT INTO documents (document_type, reference_type, reference_id, title, file_path, file_name, file_size, tags, notes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(document_type || 'other', reference_type || null, reference_id || null, title || req.file.originalname, `/uploads/${req.file.filename}`, req.file.originalname, req.file.size, tags || null, notes || null, req.user.id);
  res.status(201).json({ id: r.lastInsertRowid, file_path: `/uploads/${req.file.filename}` });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const fullPath = path.join(__dirname, '..', doc.file_path);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ message: 'Document deleted' });
});

module.exports = router;
