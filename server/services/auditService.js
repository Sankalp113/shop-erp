const { getDb } = require('../models/database');

function auditLog(userId, username, action, module, recordId, oldValues, newValues, ipAddress) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, module, record_id, old_values, new_values, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, username, action, module,
      recordId ? String(recordId) : null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

module.exports = { auditLog };
