require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { initializeDatabase } = require('./models/database');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const productsRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const purchasesRoutes = require('./routes/purchases');
const vendorsRoutes = require('./routes/vendors');
const customersRoutes = require('./routes/customers');
const staffRoutes = require('./routes/staff');
const expensesRoutes = require('./routes/expenses');
const financeRoutes = require('./routes/finance');
const remindersRoutes = require('./routes/reminders');
const reportsRoutes = require('./routes/reports');
const documentsRoutes = require('./routes/documents');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const auditRoutes = require('./routes/audit');
const { authenticate } = require('./middleware/auth');
const reminderService = require('./services/reminderService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize DB
initializeDatabase();

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/products', authenticate, productsRoutes);
app.use('/api/inventory', authenticate, inventoryRoutes);
app.use('/api/sales', authenticate, salesRoutes);
app.use('/api/purchases', authenticate, purchasesRoutes);
app.use('/api/vendors', authenticate, vendorsRoutes);
app.use('/api/customers', authenticate, customersRoutes);
app.use('/api/staff', authenticate, staffRoutes);
app.use('/api/expenses', authenticate, expensesRoutes);
app.use('/api/finance', authenticate, financeRoutes);
app.use('/api/reminders', authenticate, remindersRoutes);
app.use('/api/reports', authenticate, reportsRoutes);
app.use('/api/documents', authenticate, documentsRoutes);
app.use('/api/users', authenticate, usersRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/audit', authenticate, auditRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Cron jobs
cron.schedule('0 9 * * *', () => reminderService.checkAndCreateReminders()); // 9 AM daily
cron.schedule('0 0 * * *', () => reminderService.generateDailySummary());    // Midnight

app.listen(PORT, () => {
  console.log(`\n🚀 Cloth Shop ERP Server running on http://localhost:${PORT}`);
  console.log(`📊 API ready | Database initialized\n`);
});
