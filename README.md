# Janta Kapad Bhandar ERP

> A complete cloud-based business management system for Janta Kapad Bhandar — built with Next.js 16 and Firebase.

**🌐 Live URL:** [https://sankalp113.github.io/shop-erp/](https://sankalp113.github.io/shop-erp/)

---

## Features

| Module | Features |
|---|---|
| 🛒 **Sales (POS)** | New bills, history, returns & exchange |
| 📦 **Inventory** | Products, stock, adjustments, low stock, aging |
| 🚚 **Purchases** | New orders, purchase history |
| 🏪 **Vendors** | Vendor list, outstanding balances |
| 👥 **Customers** | Customer list, credit outstanding |
| 👷 **Staff** | Employees, attendance, salary |
| 💰 **Expenses** | Misc, electricity, rent, recurring |
| 🏦 **Accounts** | Cash book, bank accounts, day reconciliation |
| 📊 **Reports** | Business analytics |
| 🔔 **Reminders** | Task reminders |
| 📁 **Documents** | Document storage |
| ⚙️ **Admin** | Users & roles, audit log, settings |

---

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Static Export)
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Storage:** Firebase Storage
- **Hosting:** GitHub Pages (auto-deploy on push to `main`)
- **PWA:** Installable on mobile & desktop

---

## Deployment

Every push to `main` automatically deploys via GitHub Actions → GitHub Pages.

No manual steps needed.

---

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

> Requires `.env.local` with Firebase credentials.
