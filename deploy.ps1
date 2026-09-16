# ╔══════════════════════════════════════════════════════════╗
# ║       CLOTH SHOP ERP — Firebase Deploy Script           ║
# ║  Run this AFTER filling in your Firebase credentials    ║
# ╚══════════════════════════════════════════════════════════╝

$env:PATH += ";C:\Program Files\nodejs;C:\Users\Administrator\AppData\Roaming\npm"

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Cloth Shop ERP — Firebase Deployment" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check .env.local has real values
$envContent = Get-Content ".\.env.local" -Raw
if ($envContent -match "PLACEHOLDER") {
    Write-Host "❌ ERROR: .env.local still has PLACEHOLDER values!" -ForegroundColor Red
    Write-Host "   Please fill in your Firebase credentials first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Firebase credentials found in .env.local" -ForegroundColor Green
Write-Host ""

# Step 1: Install dependencies
Write-Host "📦 [1/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "❌ npm install failed" -ForegroundColor Red; exit 1 }

# Step 2: Build Next.js static export
Write-Host ""
Write-Host "🔨 [2/5] Building Next.js app (static export)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build failed" -ForegroundColor Red; exit 1 }
Write-Host "✅ Build complete — output in ./out/" -ForegroundColor Green

# Step 3: Install Firebase CLI if needed
Write-Host ""
Write-Host "🔥 [3/5] Checking Firebase CLI..." -ForegroundColor Yellow
$firebasePath = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebasePath) {
    Write-Host "   Installing Firebase CLI globally..." -ForegroundColor Yellow
    npm install -g firebase-tools
}
Write-Host "✅ Firebase CLI ready" -ForegroundColor Green

# Step 4: Firebase login check
Write-Host ""
Write-Host "🔐 [4/5] Checking Firebase login..." -ForegroundColor Yellow
firebase projects:list --project shop-erp-9dbac 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Logging in to Firebase..." -ForegroundColor Yellow
    firebase login
}

# Step 5: Deploy
Write-Host ""
Write-Host "🚀 [5/5] Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting --project shop-erp-9dbac
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Hosting deploy failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "  🌐 Live URL: https://shop-erp-9dbac.web.app" -ForegroundColor Cyan
Write-Host "  🌐 Alt URL:  https://shop-erp-9dbac.firebaseapp.com" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Open on any device:" -ForegroundColor White
Write-Host "  📱 Mobile: Open Chrome → visit the URL above" -ForegroundColor White
Write-Host "  💻 Laptop: Any browser → visit the URL above" -ForegroundColor White
Write-Host "  📲 Install as App: Chrome menu → Add to Home Screen" -ForegroundColor White
Write-Host ""
