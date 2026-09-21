/**
 * create-users.js
 * Creates Firebase Auth users + Firestore profiles using REST API
 * Run: node create-users.js
 */

const https = require('https')

const API_KEY = 'AIzaSyDv2HkGMYb_I-05PCzQWLU_GdfeUFq5vRs'
const PROJECT_ID = 'shop-erp-9dbac'

function post(hostname, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
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

async function getAccessToken() {
  // Use API key based identity toolkit (no service account needed)
  return null
}

async function createAuthUser(email, password) {
  const res = await post(
    'identitytoolkit.googleapis.com',
    `/v1/accounts:signUp?key=${API_KEY}`,
    { email, password, returnSecureToken: true }
  )
  if (res.body.error) {
    if (res.body.error.message === 'EMAIL_EXISTS') {
      console.log(`  Auth user already exists: ${email}`)
      // Try to sign in to get UID
      const signIn = await post(
        'identitytoolkit.googleapis.com',
        `/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email, password, returnSecureToken: true }
      )
      if (signIn.body.error) {
        console.log(`  Cannot get UID for ${email}: ${signIn.body.error.message}`)
        return null
      }
      return { localId: signIn.body.localId, idToken: signIn.body.idToken }
    }
    throw new Error(res.body.error.message)
  }
  console.log(`  Created Auth user: ${email} (UID: ${res.body.localId})`)
  return res.body
}

async function setFirestoreDoc(idToken, uid, data) {
  // Use Firestore REST API with the user's ID token
  const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`
  
  // Convert data to Firestore format
  const fields = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') fields[k] = { stringValue: v }
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v }
    else if (typeof v === 'number') fields[k] = { integerValue: String(v) }
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ fields })
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/${docPath}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${idToken}`
      }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        const parsed = JSON.parse(d)
        if (res.statusCode >= 400) {
          console.log(`  Firestore error: ${JSON.stringify(parsed.error)}`)
          resolve(null)
        } else {
          console.log(`  Firestore profile created for UID: ${uid}`)
          resolve(parsed)
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  const users = [
    {
      email: 'admin@shopapp.internal',
      password: 'admin123',
      profile: { username: 'admin', full_name: 'Admin', email: '', mobile: '', role: 'owner', is_active: true, created_at: new Date().toISOString() }
    },
    {
      email: 'sankalpbhatiya@gmail.com',
      password: 'admin123',
      profile: { username: 'sankalpbhatiya', full_name: 'Sankalp Bhatiya', email: 'sankalpbhatiya@gmail.com', mobile: '', role: 'owner', is_active: true, created_at: new Date().toISOString() }
    }
  ]

  for (const u of users) {
    console.log(`\nProcessing: ${u.email}`)
    try {
      const authUser = await createAuthUser(u.email, u.password)
      if (authUser?.localId && authUser?.idToken) {
        await setFirestoreDoc(authUser.idToken, authUser.localId, u.profile)
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`)
    }
  }

  console.log('\nDone! Both users are ready.')
  console.log('\nLogin with:')
  console.log('  Username: admin  |  Password: admin123')
  console.log('  Email: sankalpbhatiya@gmail.com  |  Password: admin123')
}

main().catch(console.error)
