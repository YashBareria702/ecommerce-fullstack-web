const SESSION_SECONDS = 60 * 60 * 24 * 30
const PASSWORD_ITERATIONS = 100_000

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

function encode(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function decode(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function passwordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256)
  return `pbkdf2$${PASSWORD_ITERATIONS}$${encode(salt)}$${encode(new Uint8Array(bits))}`
}

async function verifyPassword(password, saved) {
  const [scheme, iterations, salt, expected] = String(saved || '').split('$')
  if (scheme !== 'pbkdf2' || !iterations || !salt || !expected) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: decode(salt), iterations: Number(iterations), hash: 'SHA-256' }, key, 256))
  const target = decode(expected)
  if (actual.length !== target.length) return false
  let difference = 0
  for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ target[index]
  return difference === 0
}

async function issueSession(db, userId, role) {
  const token = encode(crypto.getRandomValues(new Uint8Array(32)))
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  await db.prepare('INSERT INTO sessions (token_hash, user_id, role, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await digest(token), userId, role, expiresAt).run()
  return token
}

async function authorizedUser(request, db) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  return db.prepare('SELECT user_id, role FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await digest(token), Math.floor(Date.now() / 1000)).first()
}

function indianMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  return /^[6-9]\d{9}$/.test(national) ? `91${national}` : null
}

async function notifyOrder(request, env) {
  const session = await authorizedUser(request, env.DB)
  if (!session || session.role !== 'customer') return json({ message: 'Please sign in before placing an order.' }, 401)
  const { orderId, customerName, total, customerMobile } = await request.json()
  const ownerMobile = indianMobile(env.STORE_OWNER_PHONE)
  const customerPhone = indianMobile(customerMobile)
  if (!customerPhone || !ownerMobile || !orderId || !Number.isFinite(Number(total))) {
    return json({ message: 'Order SMS is not configured yet.' }, 503)
  }
  const authKey = env.MSG91_AUTH_KEY
  const customerTemplate = env.MSG91_CUSTOMER_ORDER_TEMPLATE_ID
  const ownerTemplate = env.MSG91_OWNER_ORDER_TEMPLATE_ID
  if (!authKey || !customerTemplate || !ownerTemplate) return json({ message: 'Order SMS is not configured yet.' }, 503)
  const send = (mobile, templateId) => fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      short_url: '0',
      realTimeResponse: '1',
      recipients: [{ mobiles: mobile, VAR1: String(customerName || 'Customer'), VAR2: String(orderId), VAR3: String(total) }],
    }),
  })
  const results = await Promise.all([send(customerPhone, customerTemplate), send(ownerMobile, ownerTemplate)])
  if (results.some(result => !result.ok)) return json({ message: 'Order placed, but SMS could not be sent.' }, 502)
  return json({ message: 'Order SMS sent to the customer and store owner.' })
}

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ message: 'The shop database is not connected yet.' }, 503)
  const path = new URL(request.url).pathname

  try {
    if (request.method === 'POST' && path === '/api/register') {
      const { name, username, password } = await request.json()
      const loginName = String(username || '').trim().toLowerCase()
      const displayName = String(name || loginName).trim().slice(0, 80)
      if (!/^[a-z0-9_.-]{3,32}$/.test(loginName)) return json({ message: 'Username must be 3–32 characters and use letters, numbers, dots, dashes or underscores.' }, 400)
      if (typeof password !== 'string' || password.length < 8 || password.length > 72) return json({ message: 'Password must be at least 8 characters.' }, 400)
      const result = await env.DB.prepare('INSERT OR IGNORE INTO users (name, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .bind(displayName, loginName, await passwordHash(password), Math.floor(Date.now() / 1000)).run()
      if (!result.meta?.changes) return json({ message: 'That username is already taken. Please choose another.' }, 409)
      return json({ message: 'Account created. You can now sign in.', username: loginName }, 201)
    }

    if (request.method === 'POST' && path === '/api/login') {
      const { username, password } = await request.json()
      const loginName = String(username || '').trim().toLowerCase()
      if (typeof password !== 'string' || password.length > 72) return json({ message: 'Invalid credentials' }, 400)
      const user = await env.DB.prepare('SELECT id, username, name, password_hash FROM users WHERE username = ?').bind(loginName).first()
      if (!user || !(await verifyPassword(password, user.password_hash))) return json({ message: 'Invalid credentials' }, 400)
      const token = await issueSession(env.DB, user.id, 'customer')
      return json({ message: 'Logged in successfully', token, user: { id: user.id, name: user.name, username: user.username } })
    }

    if (request.method === 'POST' && path === '/api/admin/login') {
      const { password } = await request.json()
      if (!env.ADMIN_PASSWORD) return json({ message: 'Owner login is not configured yet.' }, 503)
      if (typeof password !== 'string' || password !== env.ADMIN_PASSWORD) return json({ message: 'Incorrect owner password.' }, 401)
      const token = await issueSession(env.DB, 0, 'owner')
      return json({ token })
    }

    if (request.method === 'POST' && path === '/api/orders/notify') return await notifyOrder(request, env)
    return json({ message: 'API route not found.' }, 404)
  } catch (error) {
    console.error('Quality Corner API error:', error)
    return json({ message: 'The shop server could not complete this request.' }, 500)
  }
}
