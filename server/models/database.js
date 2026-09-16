const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'shop.db');
let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();
  
  db.exec(`
    -- =============================================
    -- AUTH & USER MANAGEMENT
    -- =============================================
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      mobile TEXT,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      UNIQUE(module, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- SETTINGS
    -- =============================================
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      mobile TEXT,
      email TEXT,
      gstin TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- PRODUCT CATALOG
    -- =============================================
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES categories(id),
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hex_code TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS fabrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE,
      name TEXT NOT NULL,
      sku TEXT,
      category_id INTEGER REFERENCES categories(id),
      brand_id INTEGER REFERENCES brands(id),
      fabric_id INTEGER REFERENCES fabrics(id),
      description TEXT,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      mrp REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      min_stock_level INTEGER DEFAULT 5,
      location TEXT,
      image_path TEXT,
      has_variants INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_id INTEGER REFERENCES sizes(id),
      color_id INTEGER REFERENCES colors(id),
      sku TEXT,
      barcode TEXT UNIQUE,
      purchase_price REAL,
      selling_price REAL,
      mrp REAL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- STOCK
    -- =============================================
    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      quantity INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      transaction_type TEXT NOT NULL, -- sale, purchase, adjustment, return, opening
      reference_type TEXT, -- sale, purchase, adjustment
      reference_id INTEGER,
      quantity_change INTEGER NOT NULL,
      quantity_before INTEGER,
      quantity_after INTEGER,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      adjustment_type TEXT NOT NULL, -- damaged, missing, physical_count, expired, sample, internal_use, correction
      quantity_change INTEGER NOT NULL,
      quantity_before INTEGER,
      quantity_after INTEGER,
      reason TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- CUSTOMERS
    -- =============================================
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE,
      name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      credit_limit REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      transaction_type TEXT NOT NULL, -- sale, payment, return, adjustment, opening
      reference_type TEXT,
      reference_id INTEGER,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      notes TEXT,
      transaction_date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- VENDORS
    -- =============================================
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_code TEXT UNIQUE,
      name TEXT NOT NULL,
      company_name TEXT,
      contact_person TEXT,
      mobile TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      gstin TEXT,
      bank_name TEXT,
      bank_account TEXT,
      bank_ifsc TEXT,
      payment_terms INTEGER DEFAULT 30,
      opening_balance REAL DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vendor_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL REFERENCES vendors(id),
      transaction_type TEXT NOT NULL, -- purchase, payment, return, adjustment, opening
      reference_type TEXT,
      reference_id INTEGER,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      notes TEXT,
      transaction_date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- SALES
    -- =============================================
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      sale_date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      customer_mobile TEXT,
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'cash', -- cash, upi, card, credit, split
      cash_amount REAL DEFAULT 0,
      upi_amount REAL DEFAULT 0,
      card_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'completed', -- completed, cancelled, returned
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      product_name TEXT NOT NULL,
      size TEXT,
      color TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_price REAL NOT NULL,
      purchase_price REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sale_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT NOT NULL UNIQUE,
      original_sale_id INTEGER REFERENCES sales(id),
      return_date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      return_reason TEXT,
      total_return_amount REAL DEFAULT 0,
      refund_mode TEXT, -- cash, upi, exchange, credit
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
      sale_item_id INTEGER REFERENCES sale_items(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL
    );

    -- =============================================
    -- PURCHASES
    -- =============================================
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT NOT NULL UNIQUE,
      vendor_invoice_number TEXT,
      purchase_date TEXT NOT NULL,
      vendor_id INTEGER REFERENCES vendors(id),
      vendor_name TEXT,
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      outstanding_amount REAL DEFAULT 0,
      due_date TEXT,
      payment_mode TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending', -- pending, partial, paid
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      product_name TEXT NOT NULL,
      size TEXT,
      color TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      reference_number TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT NOT NULL UNIQUE,
      purchase_id INTEGER REFERENCES purchases(id),
      vendor_id INTEGER REFERENCES vendors(id),
      return_date TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- STAFF & HR
    -- =============================================
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT UNIQUE,
      name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      address TEXT,
      joining_date TEXT,
      designation TEXT,
      basic_salary REAL DEFAULT 0,
      bank_name TEXT,
      bank_account TEXT,
      bank_ifsc TEXT,
      document_paths TEXT, -- JSON array
      status TEXT DEFAULT 'active', -- active, inactive, resigned
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL, -- present, absent, half_day, leave, holiday
      check_in TEXT,
      check_out TEXT,
      overtime_hours REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      UNIQUE(employee_id, attendance_date)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      leave_type TEXT NOT NULL, -- casual, sick, earned, unpaid
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending', -- pending, approved, rejected
      approved_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      salary_month TEXT NOT NULL, -- YYYY-MM
      basic_salary REAL DEFAULT 0,
      working_days INTEGER DEFAULT 0,
      present_days REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_amount REAL DEFAULT 0,
      incentive REAL DEFAULT 0,
      commission REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      advance_deduction REAL DEFAULT 0,
      leave_deduction REAL DEFAULT 0,
      other_deduction REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      payment_date TEXT,
      payment_mode TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending', -- pending, paid, partial
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, salary_month)
    );

    -- =============================================
    -- EXPENSES
    -- =============================================
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category_id INTEGER REFERENCES expense_categories(id),
      category_name TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL, -- cash, upi, card, bank
      vendor_person TEXT,
      receipt_path TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS electricity_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consumer_number TEXT,
      meter_number TEXT,
      bill_date TEXT NOT NULL,
      billing_period_start TEXT,
      billing_period_end TEXT,
      previous_reading REAL DEFAULT 0,
      current_reading REAL DEFAULT 0,
      units_consumed REAL DEFAULT 0,
      bill_amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      payment_date TEXT,
      payment_mode TEXT,
      receipt_path TEXT,
      status TEXT DEFAULT 'pending', -- pending, paid, overdue
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rent_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rent_type TEXT NOT NULL, -- monthly, quarterly, annual
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      payment_date TEXT,
      payment_mode TEXT,
      receipt_path TEXT,
      status TEXT DEFAULT 'pending', -- pending, paid, overdue
      landlord_name TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES expense_categories(id),
      amount REAL NOT NULL,
      frequency TEXT NOT NULL, -- daily, weekly, monthly, quarterly, annual
      next_due_date TEXT NOT NULL,
      payment_mode TEXT,
      vendor_person TEXT,
      is_active INTEGER DEFAULT 1,
      auto_create INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- CASH & BANK
    -- =============================================
    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_date TEXT NOT NULL,
      transaction_type TEXT NOT NULL, -- opening, sale, purchase_payment, expense, salary, deposit, withdrawal, other
      reference_type TEXT,
      reference_id INTEGER,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT,
      ifsc_code TEXT,
      opening_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
      transaction_date TEXT NOT NULL,
      transaction_type TEXT NOT NULL, -- deposit, withdrawal, transfer, upi_collection, card_collection, charge
      reference_type TEXT,
      reference_id INTEGER,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL DEFAULT 0,
      reference_number TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- REMINDERS & NOTIFICATIONS
    -- =============================================
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reminder_type TEXT NOT NULL, -- vendor_payment, customer_payment, electricity, rent, salary, gst, custom
      reference_type TEXT,
      reference_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      amount REAL,
      status TEXT DEFAULT 'pending', -- pending, completed, dismissed
      priority TEXT DEFAULT 'normal', -- low, normal, high, critical
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info', -- info, warning, error, success
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- DOCUMENTS
    -- =============================================
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT NOT NULL, -- purchase_invoice, electricity_bill, rent_receipt, salary_slip, license, other
      reference_type TEXT,
      reference_id INTEGER,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      tags TEXT,
      notes TEXT,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- DAILY SUMMARIES
    -- =============================================
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_date TEXT NOT NULL UNIQUE,
      total_sales REAL DEFAULT 0,
      total_bills INTEGER DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      upi_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      credit_sales REAL DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      total_expenses REAL DEFAULT 0,
      gross_profit REAL DEFAULT 0,
      new_customers INTEGER DEFAULT 0,
      total_returns REAL DEFAULT 0,
      low_stock_items INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default data
  seedDefaultData(db);
  console.log('✅ Database initialized successfully');
}

function seedDefaultData(db) {
  // Default roles
  const roles = [
    { name: 'owner', description: 'Full system access', is_system: 1 },
    { name: 'manager', description: 'Sales, inventory, customers, vendors, reports', is_system: 1 },
    { name: 'billing', description: 'Billing and customer info only', is_system: 1 },
    { name: 'inventory', description: 'Stock and purchase operations', is_system: 1 },
    { name: 'accountant', description: 'Payments, expenses, ledgers, financial reports', is_system: 1 },
  ];
  const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (name, description, is_system) VALUES (?, ?, ?)`);
  roles.forEach(r => insertRole.run(r.name, r.description, r.is_system));

  // Default admin user
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    const ownerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('owner');
    db.prepare(`INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)`)
      .run('admin', hash, 'Shop Owner', ownerRole.id);
  }

  // Default settings
  const defaultSettings = [
    ['shop_name', 'My Cloth Shop'],
    ['shop_address', '123 Main Street, City'],
    ['shop_mobile', '9876543210'],
    ['shop_email', ''],
    ['shop_gstin', ''],
    ['currency_symbol', '₹'],
    ['invoice_prefix', 'INV'],
    ['invoice_counter', '1'],
    ['purchase_prefix', 'PUR'],
    ['purchase_counter', '1'],
    ['financial_year_start', '04'],
    ['low_stock_alert_days', '7'],
  ];
  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  defaultSettings.forEach(([k, v]) => insertSetting.run(k, v));

  // Default expense categories
  const expenseCategories = [
    'Transportation', 'Packaging', 'Tea & Refreshments', 'Cleaning',
    'Repairs & Maintenance', 'Internet', 'Telephone', 'Advertising',
    'Marketing', 'Courier', 'Stationery', 'Bank Charges',
    'Travel', 'Electricity', 'Rent', 'Security', 'Other'
  ];
  const insertCat = db.prepare(`INSERT OR IGNORE INTO expense_categories (name) VALUES (?)`);
  expenseCategories.forEach(c => insertCat.run(c));

  // Default sizes
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', '42'];
  const insertSize = db.prepare(`INSERT OR IGNORE INTO sizes (name, sort_order) VALUES (?, ?)`);
  sizes.forEach((s, i) => insertSize.run(s, i));

  // Default colors
  const colors = [
    { name: 'White', hex: '#FFFFFF' }, { name: 'Black', hex: '#000000' },
    { name: 'Red', hex: '#FF0000' }, { name: 'Blue', hex: '#0000FF' },
    { name: 'Green', hex: '#008000' }, { name: 'Yellow', hex: '#FFFF00' },
    { name: 'Pink', hex: '#FFC0CB' }, { name: 'Orange', hex: '#FFA500' },
    { name: 'Purple', hex: '#800080' }, { name: 'Grey', hex: '#808080' },
    { name: 'Brown', hex: '#A52A2A' }, { name: 'Navy', hex: '#000080' },
  ];
  const insertColor = db.prepare(`INSERT OR IGNORE INTO colors (name, hex_code) VALUES (?, ?)`);
  colors.forEach(c => insertColor.run(c.name, c.hex));

  // Default categories
  const categories = [
    'Shirts', 'T-Shirts', 'Jeans', 'Trousers', 'Salwar Kameez',
    'Sarees', 'Kurtas', 'Leggings', 'Tops', 'Jackets',
    'Kids Wear', 'Innerwear', 'Accessories'
  ];
  const insertCatProd = db.prepare(`INSERT OR IGNORE INTO categories (name) VALUES (?)`);
  categories.forEach(c => insertCatProd.run(c));

  // Default bank account
  const existingBank = db.prepare('SELECT id FROM bank_accounts WHERE account_name = ?').get('Main Account');
  if (!existingBank) {
    db.prepare(`INSERT INTO bank_accounts (account_name, bank_name, opening_balance) VALUES (?, ?, ?)`)
      .run('Main Account', 'State Bank', 0);
  }

  // Default branch
  const existingBranch = db.prepare('SELECT id FROM branches WHERE name = ?').get('Main Branch');
  if (!existingBranch) {
    db.prepare(`INSERT INTO branches (name) VALUES (?)`).run('Main Branch');
  }
}

module.exports = { getDb, initializeDatabase };
