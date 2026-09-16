const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { auditLog } = require('../services/auditService');

// ─── EMPLOYEES ───────────────────────────────────────

router.get('/employees', (req, res) => {
  const db = getDb();
  const { search, status, page = 1, limit = 50 } = req.query;
  let where = ['1=1'];
  let params = [];
  if (search) { where.push('(e.name LIKE ? OR e.mobile LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (status) { where.push('e.status = ?'); params.push(status); }
  const employees = db.prepare(`SELECT * FROM employees e WHERE ${where.join(' AND ')} ORDER BY e.name ASC LIMIT ? OFFSET ?`).all(...params, limit, (page-1)*limit);
  const total = db.prepare(`SELECT COUNT(*) as count FROM employees e WHERE ${where.join(' AND ')}`).get(...params);
  res.json({ data: employees, total: total.count });
});

router.get('/employees/:id', (req, res) => {
  const db = getDb();
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const recentAttendance = db.prepare('SELECT * FROM attendance WHERE employee_id = ? ORDER BY attendance_date DESC LIMIT 30').all(req.params.id);
  const currentSalary = db.prepare("SELECT * FROM salaries WHERE employee_id = ? AND salary_month = strftime('%Y-%m', 'now')").get(req.params.id);
  res.json({ ...emp, recent_attendance: recentAttendance, current_salary: currentSalary });
});

router.post('/employees', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM employees').get().c;
  const employee_code = `EMP${String(count + 1).padStart(4, '0')}`;
  const { name, mobile, email, address, joining_date, designation, basic_salary, bank_name, bank_account, bank_ifsc } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(`INSERT INTO employees (employee_code, name, mobile, email, address, joining_date, designation, basic_salary, bank_name, bank_account, bank_ifsc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(employee_code, name, mobile || null, email || null, address || null, joining_date || null, designation || null, basic_salary || 0, bank_name || null, bank_account || null, bank_ifsc || null);
  auditLog(req.user.id, req.user.username, 'CREATE_EMPLOYEE', 'staff', r.lastInsertRowid, null, { name, employee_code }, req.ip);
  res.status(201).json({ id: r.lastInsertRowid, employee_code });
});

router.put('/employees/:id', (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Employee not found' });
  const { name, mobile, email, address, designation, basic_salary, bank_name, bank_account, bank_ifsc, status } = req.body;
  db.prepare(`UPDATE employees SET name=?, mobile=?, email=?, address=?, designation=?, basic_salary=?, bank_name=?, bank_account=?, bank_ifsc=?, status=?, updated_at=? WHERE id=?`)
    .run(name || old.name, mobile, email, address, designation, basic_salary ?? old.basic_salary, bank_name, bank_account, bank_ifsc, status || old.status, new Date().toISOString(), req.params.id);
  auditLog(req.user.id, req.user.username, 'UPDATE_EMPLOYEE', 'staff', req.params.id, old, req.body, req.ip);
  res.json({ message: 'Employee updated' });
});

// ─── ATTENDANCE ──────────────────────────────────────

router.get('/attendance', (req, res) => {
  const db = getDb();
  const { employee_id, month, date } = req.query;
  let where = ['1=1'];
  let params = [];
  if (employee_id) { where.push('a.employee_id = ?'); params.push(employee_id); }
  if (month) { where.push("strftime('%Y-%m', a.attendance_date) = ?"); params.push(month); }
  if (date) { where.push('a.attendance_date = ?'); params.push(date); }
  const attendance = db.prepare(`
    SELECT a.*, e.name as employee_name, e.employee_code
    FROM attendance a JOIN employees e ON a.employee_id = e.id
    WHERE ${where.join(' AND ')} ORDER BY a.attendance_date DESC, e.name
  `).all(...params);
  res.json(attendance);
});

router.post('/attendance', (req, res) => {
  const db = getDb();
  const { employee_id, attendance_date, status, check_in, check_out, overtime_hours, notes } = req.body;
  if (!employee_id || !attendance_date || !status) return res.status(400).json({ error: 'employee_id, attendance_date, status required' });
  db.prepare(`INSERT OR REPLACE INTO attendance (employee_id, attendance_date, status, check_in, check_out, overtime_hours, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(employee_id, attendance_date, status, check_in || null, check_out || null, overtime_hours || 0, notes || null, req.user.id);
  res.status(201).json({ message: 'Attendance recorded' });
});

router.post('/attendance/bulk', (req, res) => {
  const db = getDb();
  const { date, records } = req.body;
  const insertMany = db.transaction(() => {
    records.forEach(r => {
      // Support both {date} field or per-record {attendance_date}
      const attDate = r.attendance_date || date;
      db.prepare('INSERT OR REPLACE INTO attendance (employee_id, attendance_date, status, check_in, check_out, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(r.employee_id, attDate, r.status || 'present', r.check_in_time || null, r.check_out_time || null, r.notes || null, req.user.id);
    });
  });
  insertMany();
  res.json({ message: `${records.length} attendance records saved` });
});

// ─── SALARY ──────────────────────────────────────────

// Support both /salary and /salaries
const getSalaries = (req, res) => {
  const db = getDb();
  const { month, employee_id } = req.query;
  let where = ['1=1'];
  let params = [];
  if (month) { where.push('s.salary_month = ?'); params.push(month); }
  if (employee_id) { where.push('s.employee_id = ?'); params.push(employee_id); }
  const salaries = db.prepare(`
    SELECT s.*, e.name as employee_name, e.employee_code, e.designation
    FROM salaries s JOIN employees e ON s.employee_id = e.id
    WHERE ${where.join(' AND ')} ORDER BY e.name
  `).all(...params);
  res.json({ data: salaries, total: salaries.length });
};
router.get('/salary', getSalaries);
router.get('/salaries', getSalaries);

// Support both /salary/generate and /salaries/generate
const generateSalariesHandler = (req, res) => {
  const db = getDb();
  const salary_month = req.body.salary_month || req.body.month;
  if (!salary_month) return res.status(400).json({ error: 'salary_month required (YYYY-MM)' });

  const generateSalaries = db.transaction(() => {
    const employees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
    const generated = [];
    employees.forEach(emp => {
      const existing = db.prepare('SELECT id FROM salaries WHERE employee_id = ? AND salary_month = ?').get(emp.id, salary_month);
      if (existing) return;
      const [year, month] = salary_month.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      const attendanceStats = db.prepare(`SELECT COUNT(CASE WHEN status = 'present' THEN 1 END) as present, COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_days, SUM(overtime_hours) as overtime_hours FROM attendance WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?`).get(emp.id, salary_month);
      const presentDays = (attendanceStats.present || 0) + (attendanceStats.half_days || 0) * 0.5 || daysInMonth;
      const dailySalary = emp.basic_salary / daysInMonth;
      const earnedSalary = dailySalary * presentDays;
      const overtimeAmount = ((emp.basic_salary / daysInMonth / 8) * 1.5) * (attendanceStats.overtime_hours || 0);
      const netSalary = earnedSalary + overtimeAmount;
      const r = db.prepare(`INSERT INTO salaries (employee_id, salary_month, basic_salary, working_days, present_days, overtime_hours, overtime_amount, net_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`).run(emp.id, salary_month, emp.basic_salary, daysInMonth, presentDays, attendanceStats.overtime_hours || 0, overtimeAmount, netSalary);
      generated.push({ employee: emp.name, id: r.lastInsertRowid, net_salary: netSalary });
    });
    return generated;
  });
  const result = generateSalaries();
  res.json({ message: `${result.length} salary records generated`, data: result });
};

router.post('/salary/generate', (req, res) => {
  const db = getDb();
  const { salary_month } = req.body;
  if (!salary_month) return res.status(400).json({ error: 'salary_month required (YYYY-MM)' });

  const generateSalaries = db.transaction(() => {
    const employees = db.prepare("SELECT * FROM employees WHERE status = 'active'").all();
    const generated = [];

    employees.forEach(emp => {
      const existing = db.prepare('SELECT id FROM salaries WHERE employee_id = ? AND salary_month = ?').get(emp.id, salary_month);
      if (existing) return;

      // Calculate attendance
      const [year, month] = salary_month.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      const attendanceStats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
          COUNT(CASE WHEN status = 'half_day' THEN 1 END) as half_days,
          SUM(overtime_hours) as overtime_hours
        FROM attendance WHERE employee_id = ? AND strftime('%Y-%m', attendance_date) = ?
      `).get(emp.id, salary_month);

      const presentDays = (attendanceStats.present || 0) + (attendanceStats.half_days || 0) * 0.5;
      const dailySalary = emp.basic_salary / daysInMonth;
      const earnedSalary = dailySalary * presentDays;
      const leaveDeduction = Math.max(0, dailySalary * (daysInMonth - presentDays - 4)); // 4 holidays
      const overtimeAmount = ((emp.basic_salary / daysInMonth / 8) * 1.5) * (attendanceStats.overtime_hours || 0);
      const netSalary = earnedSalary + overtimeAmount - leaveDeduction;

      const r = db.prepare(`
        INSERT INTO salaries (employee_id, salary_month, basic_salary, working_days, present_days, overtime_hours, overtime_amount, leave_deduction, net_salary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(emp.id, salary_month, emp.basic_salary, daysInMonth, presentDays, attendanceStats.overtime_hours || 0, overtimeAmount, leaveDeduction, netSalary);
      
      generated.push({ employee: emp.name, id: r.lastInsertRowid, net_salary: netSalary });
    });

    return generated;
  });

  const result = generateSalaries();
  res.json({ message: `${result.length} salary records generated`, data: result });
});
router.post('/salaries/generate', generateSalariesHandler);

router.put('/salary/:id', (req, res) => {
  const db = getDb();
  const { incentive, commission, bonus, advance_deduction, other_deduction, notes } = req.body;
  const salary = db.prepare('SELECT * FROM salaries WHERE id = ?').get(req.params.id);
  if (!salary) return res.status(404).json({ error: 'Salary record not found' });

  const newIncentive = incentive ?? salary.incentive;
  const newCommission = commission ?? salary.commission;
  const newBonus = bonus ?? salary.bonus;
  const newAdvance = advance_deduction ?? salary.advance_deduction;
  const newOther = other_deduction ?? salary.other_deduction;
  const netSalary = salary.basic_salary * (salary.present_days / salary.working_days) + salary.overtime_amount + newIncentive + newCommission + newBonus - salary.leave_deduction - newAdvance - newOther;

  db.prepare(`UPDATE salaries SET incentive=?, commission=?, bonus=?, advance_deduction=?, other_deduction=?, net_salary=?, notes=? WHERE id=?`)
    .run(newIncentive, newCommission, newBonus, newAdvance, newOther, netSalary, notes || salary.notes, req.params.id);
  res.json({ message: 'Salary updated', net_salary: netSalary });
});

router.post('/salary/:id/pay', (req, res) => {
  const db = getDb();
  const { payment_date, payment_mode } = req.body;
  const salary = db.prepare('SELECT * FROM salaries WHERE id = ?').get(req.params.id);
  if (!salary) return res.status(404).json({ error: 'Not found' });

  const pDate = payment_date || new Date().toISOString().split('T')[0];
  db.prepare('UPDATE salaries SET status = ?, paid_amount = ?, payment_date = ?, payment_mode = ? WHERE id = ?')
    .run('paid', salary.net_salary, pDate, payment_mode || 'cash', req.params.id);

  if (!payment_mode || payment_mode === 'cash') {
    const lastCash = db.prepare('SELECT balance_after FROM cash_transactions ORDER BY id DESC LIMIT 1').get();
    const newBalance = (lastCash?.balance_after || 0) - salary.net_salary;
    db.prepare('INSERT INTO cash_transactions (transaction_date, transaction_type, description, amount, balance_after, created_by) VALUES (?, "salary", ?, ?, ?, ?)')
      .run(pDate, `Salary - ${req.params.id}`, -salary.net_salary, newBalance, req.user.id);
  }

  const expense_cat = db.prepare("SELECT id FROM expense_categories WHERE name = 'Other'").get();
  db.prepare('INSERT INTO expenses (expense_date, category_id, category_name, description, amount, payment_mode, created_by) VALUES (?, ?, "Salary", ?, ?, ?, ?)')
    .run(pDate, expense_cat?.id, `Staff Salary`, salary.net_salary, payment_mode || 'cash', req.user.id);

  auditLog(req.user.id, req.user.username, 'PAY_SALARY', 'staff', salary.id, null, { amount: salary.net_salary }, req.ip);
  res.json({ message: 'Salary paid successfully' });
});

// ─── LEAVES ──────────────────────────────────────────

router.get('/leaves', (req, res) => {
  const db = getDb();
  const { employee_id, status } = req.query;
  let where = ['1=1'];
  let params = [];
  if (employee_id) { where.push('l.employee_id = ?'); params.push(employee_id); }
  if (status) { where.push('l.status = ?'); params.push(status); }
  const leaves = db.prepare(`SELECT l.*, e.name as employee_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE ${where.join(' AND ')} ORDER BY l.start_date DESC`).all(...params);
  res.json(leaves);
});

router.post('/leaves', (req, res) => {
  const db = getDb();
  const { employee_id, leave_type, start_date, end_date, reason } = req.body;
  const days = Math.ceil((new Date(end_date) - new Date(start_date)) / 86400000) + 1;
  const r = db.prepare('INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason) VALUES (?, ?, ?, ?, ?, ?)')
    .run(employee_id, leave_type, start_date, end_date, days, reason || null);
  res.status(201).json({ id: r.lastInsertRowid, days });
});

router.put('/leaves/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare('UPDATE leaves SET status = ?, approved_by = ? WHERE id = ?').run(status, req.user.id, req.params.id);
  res.json({ message: 'Leave status updated' });
});

module.exports = router;
