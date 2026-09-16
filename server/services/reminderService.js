const { getDb } = require('../models/database');

function checkAndCreateReminders() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Check electricity bills approaching due date
  const elecBills = db.prepare("SELECT * FROM electricity_bills WHERE status = 'pending' AND due_date <= ?").all(in7Days);
  elecBills.forEach(bill => {
    const existing = db.prepare("SELECT id FROM reminders WHERE reference_type = 'electricity_bill' AND reference_id = ? AND status = 'pending'").get(bill.id);
    if (!existing) {
      db.prepare("INSERT INTO reminders (reminder_type, reference_type, reference_id, title, amount, due_date, priority) VALUES ('electricity', 'electricity_bill', ?, 'Electricity Bill Due', ?, ?, 'high')")
        .run(bill.id, bill.bill_amount, bill.due_date);
    }
  });

  // Mark overdue reminders
  db.prepare("UPDATE reminders SET priority = 'critical' WHERE due_date < ? AND status = 'pending'").run(today);

  // Check recurring expenses
  const recurring = db.prepare("SELECT * FROM recurring_expenses WHERE is_active = 1 AND next_due_date <= ?").all(today);
  recurring.forEach(rec => {
    // Create expense entry
    const existing = db.prepare("SELECT id FROM reminders WHERE reference_type = 'recurring' AND reference_id = ? AND status = 'pending'").get(rec.id);
    if (!existing) {
      db.prepare("INSERT INTO reminders (reminder_type, reference_type, reference_id, title, amount, due_date) VALUES ('custom', 'recurring', ?, ?, ?, ?)")
        .run(rec.id, `Recurring: ${rec.name}`, rec.amount, rec.next_due_date);
    }
    // Advance next_due_date
    const nextDate = calculateNextDate(rec.next_due_date, rec.frequency);
    db.prepare('UPDATE recurring_expenses SET next_due_date = ? WHERE id = ?').run(nextDate, rec.id);
  });

  console.log('✅ Reminders checked:', new Date().toISOString());
}

function calculateNextDate(currentDate, frequency) {
  const d = new Date(currentDate);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'annual': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

function generateDailySummary() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const summary = require('../routes/reports');
  // Summary generation is done via the reports API; here we just log
  console.log(`📊 Daily summary generated for ${today}`);
}

module.exports = { checkAndCreateReminders, generateDailySummary };
