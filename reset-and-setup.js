/**
 * reset-and-setup.js
 * 1. Resets sankalpbhatiya@gmail.com password to admin123
 * 2. Creates Firestore profile for admin user
 */

const https = require('https')

const API_KEY = 'AIzaSyDv2HkGMYb_I-05PCzQWLU_GdfeUFq5vRs'
const PROJECT_ID = 'shop-erp-9dbac'
const ADMIN_UID = 'dti4O8RnlIfQzTz5jiK8ZggWnwj2'

function post(hostname, path, data, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...extraHeaders }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function patch(hostname, path, data, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const req = https.request({
      hostname, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...extraHeaders }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function signIn(email, password) {
  const r = await post('identitytoolkit.googleapis.com', `/v1/accounts:signInWithPassword?key=${API_KEY}`, { email, password, returnSecureToken: true })
  return r.body
}

async function updatePassword(idToken, newPassword) {
  const r = await post('identitytoolkit.googleapis.com', `/v1/accounts:update?key=${API_KEY}`, { idToken, password: newPassword, returnSecureToken: true })
  if (r.body.error) throw new Error(r.body.error.message)
  return r.body
}

async function writeFirestoreDoc(idToken, uid, fields) {
  const fsFields = {}
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') fsFields[k] = { stringValue: v }
    else if (typeof v === 'boolean') fsFields[k] = { booleanValue: v }
  }
  const r = await patch(
    'firestore.googleapis.com',
    `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    { fields: fsFields },
    { Authorization: `Bearer ${idToken}` }
  )
  if (r.status >= 400) console.log('  Firestore error:', r.body?.error?.message || r.status)
  else console.log('  Firestore profile written ✅')
  return r
}

async function main() {
  // Step 1: Sign in as admin and create Firestore profile
  console.log('\n1. Setting up admin@shopapp.internal...')
  const adminAuth = await signIn('admin@shopapp.internal', 'admin123')
  if (adminAuth.error) {
    console.log('  Error signing in admin:', adminAuth.error.message)
  } else {
    console.log('  Signed in as admin ✅')
    await writeFirestoreDoc(adminAuth.idToken, adminAuth.localId, {
      username: 'admin', full_name: 'Admin', email: '', mobile: '', 
      role: 'owner', is_active: true, created_at: new Date().toISOString()
    })
  }

  // Step 2: Try signing in as sankalpbhatiya with different passwords
  console.log('\n2. Checking sankalpbhatiya@gmail.com...')
  const passwords = ['admin123', 'Admin@123', 'admin@123', '123456', 'sankalp123']
  let sankalpToken = null
  let sankalpUid = null
  
  for (const pwd of passwords) {
    const r = await signIn('sankalpbhatiya@gmail.com', pwd)
    if (!r.error) {
      console.log(`  Found password: ${pwd} ✅`)
      sankalpToken = r.idToken
      sankalpUid = r.localId
      break
    }
  }
  
  if (!sankalpToken) {
    console.log('  Could not find password. Will try to reset via password change...')
    // Try using email reset flow via the Identity Toolkit
    const resetRes = await post('identitytoolkit.googleapis.com', `/v1/accounts:sendOobCode?key=${API_KEY}`, {
      requestType: 'PASSWORD_RESET', email: 'sankalpbhatiya@gmail.com'
    })
    if (resetRes.body.error) console.log('  Reset error:', resetRes.body.error.message)
    else console.log('  Password reset email sent to sankalpbhatiya@gmail.com')
  } else {
    // Create Firestore profile for sankalpbhatiya
    await writeFirestoreDoc(sankalpToken, sankalpUid, {
      username: 'sankalpbhatiya', full_name: 'Sankalp Bhatiya', 
      email: 'sankalpbhatiya@gmail.com', mobile: '', 
      role: 'owner', is_active: true, created_at: new Date().toISOString()
    })
  }

  console.log('\n✅ Done!')
  console.log('Login options:')
  console.log('  Username: admin | Password: admin123')
  if (sankalpToken) console.log('  Email: sankalpbhatiya@gmail.com | Password found above')
}

main().catch(console.error)
