# 👔 Cloth Shop ERP

> Complete Cloud-Based Business Management System — Built with Next.js 14, Firebase, and TypeScript

[![Deploy to Firebase Hosting](https://github.com/your-username/cloth-shop-erp/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-username/cloth-shop-erp/actions/workflows/deploy.yml)

---

## 🌟 Features

| Module | Description |
|---|---|
| 🧾 **POS Billing** | Fast billing with cash/UPI/card/credit/split payment |
| 📦 **Products & Stock** | CRUD, variants, categories, brands, low-stock alerts |
| 🚚 **Purchases** | Vendor invoices, outstanding tracking |
| 👤 **Customers** | Ledger, credit limit, outstanding |
| 🏭 **Vendors** | GSTIN, bank details, payment terms |
| 👔 **Staff** | Employees, attendance, salary generation |
| 💰 **Accounts** | Cash book, bank accounts, day reconciliation |
| 💸 **Expenses** | Misc, electricity bills (with meter readings), rent |
| 📊 **Reports** | Sales, purchase, expense, P&L reports |
| 🔔 **Reminders** | Auto-created for credit sales, vendor dues, salary |
| ☁️ **Cloud Functions** | Daily summary, reminder updater, profit report |
| 🔐 **Role-Based Access** | Owner / Admin / Manager / Billing / Inventory / Accountant |
| 📱 **PWA** | Installable on Android, iOS, and Desktop |
| 🔄 **Real-time** | Firestore real-time sync across all devices |

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/your-username/cloth-shop-erp.git
cd cloth-shop-erp
npm install
```

### 2. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication → Email/Password**
4. Enable **Firestore Database** (Start in production mode)
5. Enable **Storage**
6. Register a **Web App** and copy the config

### 3. Configure Environment
```bash
cp .env.example .env.local
```
Edit `.env.local` and fill in your Firebase config values.

### 4. Create First Admin User
1. Start the app: `npm run dev`
2. Go to `http://localhost:3000`
3. Create a user in **Firebase Authentication Console**
4. Call the `setupFirstAdmin` Cloud Function with that UID
   ```js
   // In browser console after login:
   const { getFunctions, httpsCallable } = await import('firebase/functions')
   const fn = httpsCallable(getFunctions(), 'setupFirstAdmin')
   await fn({ uid: 'YOUR_UID', email: 'you@example.com', name: 'Your Name' })
   ```
5. You now have owner access

### 5. Deploy Firestore Rules
```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,storage
```

### 6. Deploy Cloud Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 7. Deploy to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

---

## 🏗️ Architecture

```
shop-erp/
├── src/
│   ├── app/
│   │   ├── login/           # Auth page
│   │   └── dashboard/       # All ERP modules
│   │       ├── sales/       # POS + History + Returns
│   │       ├── products/    # Products + Categories
│   │       ├── inventory/   # Stock + Adjustments + Low Stock
│   │       ├── purchases/   # New + History
│   │       ├── vendors/     # List + Outstanding
│   │       ├── customers/   # List + Credit
│   │       ├── staff/       # Employees + Attendance + Salary
│   │       ├── expenses/    # Misc + Electricity + Rent + Recurring
│   │       ├── finance/     # Cash Book + Bank + Reconciliation
│   │       ├── reports/     # All Reports
│   │       ├── reminders/   # Alerts & Reminders
│   │       ├── documents/   # File Management
│   │       └── admin/       # Users + Audit + Settings
│   ├── lib/
│   │   ├── firebase/        # config, auth, firestore services
│   │   ├── context/         # AuthContext
│   │   └── utils.ts         # Shared utilities
│   ├── types/               # TypeScript interfaces
│   └── components/          # Layout (Sidebar, Topbar)
├── functions/               # Cloud Functions (TypeScript)
├── firestore.rules          # Security Rules
├── storage.rules            # Storage Security Rules
├── firebase.json            # Firebase project config
└── .github/workflows/       # CI/CD
```

---

## 🔐 Roles & Permissions

| Role | Access |
|---|---|
| **Owner** | Everything |
| **Admin** | Everything except destructive deletes |
| **Manager** | Sales, stock, purchases, staff |
| **Billing** | POS billing and customers |
| **Inventory** | Products and stock |
| **Accountant** | Finance, expenses, salaries |

---

## ☁️ Cloud Functions

| Function | Trigger | Description |
|---|---|---|
| `onSaleCreated` | Firestore trigger | Auto-creates credit reminder, updates daily summary |
| `onPurchaseCreated` | Firestore trigger | Auto-creates vendor payment reminder |
| `generateDailySummary` | Cron: 11 PM IST daily | Generates daily P&L summary |
| `updateReminderStatuses` | Cron: every 6 hours | Updates overdue/due_soon statuses |
| `monthlySalaryReminder` | Cron: 1st of month | Creates salary processing reminder |
| `setupFirstAdmin` | HTTPS Callable | One-time setup of owner account |
| `getProfitReport` | HTTPS Callable | Secure monthly P&L calculation |

---

## 🔧 GitHub Secrets Required for CI/CD

Set these in `GitHub → Settings → Secrets → Actions`:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_TOKEN          (from: firebase login:ci)
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT (JSON from Firebase Console → Service Accounts)
```

---

## 📱 Install as App (PWA)

- **Android**: Chrome → Menu → "Add to Home Screen"
- **iOS**: Safari → Share → "Add to Home Screen"
- **Desktop**: Chrome/Edge → Address bar install icon

---

## 📄 License
Private / Proprietary — All rights reserved.
