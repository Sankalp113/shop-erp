/**
 * migrate-admin.js
 * Creates admin@jkb.in via Firebase REST API (no service account needed)
 */
const https = require('https')

const API_KEY = 'AIzaSyDv2HkGMYb_I-05PCzQWLU_GdfeUFq5vRs'
const PROJECT_ID = 'shop-erp-9dbac'

// Firestore REST base
const FS_BASE = `firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function firebaseAuthPost(endpoint, body) {
  const options = {
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/accounts:${endpoint}?key=${API_KEY}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }
  return request(options, body)
}

async function deleteUser(idToken) {
  return firebaseAuthPost('delete', { idToken })
}

async function signInUser(email, password) {
  return firebaseAuthPost('signInWithPassword', { email, password, returnSecureToken: true })
}

async function signUp(email, password) {
  return firebaseAuthPost('signUp', { email, password, returnSecureToken: true })
}

async function setFirestoreDoc(collection, docId, fields, idToken) {
  const options = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    }
  }
  return request(options, { fields })
}

function strField(v) { return { stringValue: v } }
function boolField(v) { return { booleanValue: v } }

async function main() {
  const NEW_EMAIL = 'admin@jkb.in'
  const PASSWORD = 'admin123'

  console.log('=== Creating admin@jkb.in ===\n')

  // 1. Delete old admin@jkb.in if it exists by signing in then deleting
  console.log('Step 1: Removing old admin@jkb.in if it exists...')
  const oldLogin = await signInUser(NEW_EMAIL, PASSWORD)
  if (oldLogin.status === 200) {
    const del = await deleteUser(oldLogin.body.idToken)
    console.log(`  ✅ Deleted old admin@jkb.in (status ${del.status})`)
  } else {
    console.log(`  ℹ️  admin@jkb.in doesn't exist yet`)
  }

  // 2. Also remove admin@shopapp.internal if exists  
  console.log('Step 2: Removing old admin@shopapp.internal if it exists...')
  const oldInternalLogin = await signInUser('admin@shopapp.internal', PASSWORD)
  if (oldInternalLogin.status === 200) {
    const del = await deleteUser(oldInternalLogin.body.idToken)
    console.log(`  ✅ Deleted admin@shopapp.internal (status ${del.status})`)
  } else {
    console.log(`  ℹ️  admin@shopapp.internal doesn't exist`)
  }

  // 3. Create new admin@jkb.in
  console.log('Step 3: Creating admin@jkb.in...')
  const newUser = await signUp(NEW_EMAIL, PASSWORD)
  if (newUser.status !== 200) {
    console.error('  ❌ Failed:', JSON.stringify(newUser.body))
    process.exit(1)
  }
  const { localId: uid, idToken } = newUser.body
  console.log(`  ✅ Created Firebase Auth user: ${NEW_EMAIL} (uid: ${uid})`)

  // 4. Create Firestore profile
  console.log('Step 4: Creating Firestore profile...')
  const profile = await setFirestoreDoc('users', uid, {
    uid: strField(uid),
    username: strField('admin'),
    full_name: strField('Admin'),
    email: strField(NEW_EMAIL),
    mobile: strField(''),
    role: strField('admin'),
    is_active: boolField(true),
    created_at: strField(new Date().toISOString()),
  }, idToken)
  console.log(`  Status: ${profile.status}`)
  if (profile.status === 200) {
    console.log(`  ✅ Firestore profile created`)
  } else {
    console.log(`  ⚠️  Profile response:`, JSON.stringify(profile.body).slice(0, 200))
  }

  console.log('\n=== ✅ DONE ===')
  console.log('────────────────────────────────')
  console.log('LOGIN CREDENTIALS:')
  console.log(`  Email:    admin@jkb.in`)
  console.log(`  Password: admin123`)
  console.log('────────────────────────────────')
  console.log('Or if USERNAME field shows, just type:')
  console.log(`  Username: admin`)
  console.log(`  Password: admin123`)
  process.exit(0)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
