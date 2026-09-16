// Use firebase-tools internal token refresh
const https = require('https')

const API_KEY = 'AIzaSyDv2HkGMYb_I-05PCzQWLU_GdfeUFq5vRs'
const PROJECT_ID = 'shop-erp-9dbac'

async function post(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const b = typeof body === 'string' ? body : JSON.stringify(body)
    const contentType = typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json'
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(b), ...headers }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }) } catch(e) { resolve({ status: res.statusCode, body: d }) } })
    })
    req.on('error', reject)
    req.write(b)
    req.end()
  })
}

async function patch(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body)
    const req = https.request({
      hostname, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b), ...headers }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }) } catch(e) { resolve({ status: res.statusCode, body: d }) } })
    })
    req.on('error', reject)
    req.write(b)
    req.end()
  })
}

async function getAccessToken() {
  // Use firebase-tools apiv2 module
  try {
    const { getTokens } = require('C:/Users/Administrator/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth')
    const tokens = await getTokens()
    if (tokens && tokens.access_token) return tokens.access_token
  } catch(e) {}

  try {
    const credentialStore = require('C:/Users/Administrator/AppData/Roaming/npm/node_modules/firebase-tools/lib/credentialStore')
    const creds = credentialStore.getGlobalDefaultAccount()
    if (creds && creds.tokens && creds.tokens.access_token) return creds.tokens.access_token
  } catch(e) {}

  // Try google-auth-library
  try {
    const { GoogleAuth } = require('C:/Users/Administrator/AppData/Roaming/npm/node_modules/firebase-tools/node_modules/google-auth-library')
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const { token } = await client.getAccessToken()
    return token
  } catch(e) {
    console.log('google-auth-library error:', e.message)
  }

  return null
}

async function main() {
  console.log('Getting access token from Firebase CLI...')
  const accessToken = await getAccessToken()
  
  if (!accessToken) {
    console.log('\nCould not get access token automatically.')
    console.log('\nMANUAL SETUP REQUIRED:')
    console.log('1. Go to: https://console.firebase.google.com/u/0/project/shop-erp-9dbac/authentication/providers')
    console.log('2. Enable Email/Password')
    console.log('3. Go to: https://console.firebase.google.com/u/0/project/shop-erp-9dbac/authentication/users')
    console.log('4. Click "Add user"')
    console.log('5. Email: admin@clothshop.com')
    console.log('6. Password: ShopAdmin@2024')
    console.log('7. Click Add user')
    return
  }

  console.log('Got token! Enabling Email/Password auth...')
  const authRes = await patch('identitytoolkit.googleapis.com',
    `/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled`,
    { signIn: { email: { enabled: true, passwordRequired: true } } },
    { Authorization: 'Bearer ' + accessToken }
  )
  console.log('Auth enable status:', authRes.status)

  console.log('Creating admin user...')
  const userRes = await post('identitytoolkit.googleapis.com',
    `/v1/accounts:signUp?key=${API_KEY}`,
    { email: 'admin@clothshop.com', password: 'ShopAdmin@2024', returnSecureToken: true }
  )
  
  if (userRes.body.localId) {
    console.log('\n✅ SUCCESS!')
    console.log('Email:    admin@clothshop.com')
    console.log('Password: ShopAdmin@2024')
    console.log('UID:', userRes.body.localId)
    console.log('URL: https://sankalp113.github.io/shop-erp/')
  } else {
    console.log('User result:', JSON.stringify(userRes.body))
  }
}

main().catch(e => console.error(e.message))
