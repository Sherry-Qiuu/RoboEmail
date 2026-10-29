import { randomBytes, randomInt } from 'node:crypto'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { env, isDev } from './env.ts'
import { db, findUserByEmail, findUserByUsername, newId, nowIso, publicUser } from './db.ts'
import type { UserRow } from './db.ts'
import {
  clearSessionCookie,
  consumeQuota,
  consumeTrial,
  createSession,
  destroySession,
  hashPassword,
  optionalAuth,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  sha256,
  verifyPassword,
  type AppEnv,
} from './auth.ts'
import { getCookie } from 'hono/cookie'
import { mailer } from './mailer.ts'
import { runGenerate, type GenerateFields } from './generate.ts'
import { runPolish } from './polish.ts'
import { fail, readBody } from './http.ts'
import { learn } from './routes/learn.ts'
import { people } from './routes/people.ts'

const app = new Hono<AppEnv>()

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>()
let lastSweep = 0

function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  // Without this the map keeps one entry per address that ever hit a route.
  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [staleKey, bucket] of RATE_BUCKETS) {
      if (bucket.resetAt < now) RATE_BUCKETS.delete(staleKey)
    }
  }

  const bucket = RATE_BUCKETS.get(key)
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return 'local'
}

function issueCode(email: string, purpose: string): string {
  const normalized = email.toLowerCase()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expires = new Date(Date.now() + 10 * 60_000).toISOString()
  const now = nowIso()

  // A new code retires the previous one, so "which code is current" is never
  // ambiguous and an old code cannot be replayed.
  db.prepare(
    'UPDATE email_codes SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL',
  ).run(now, normalized, purpose)

  db.prepare(
    'INSERT INTO email_codes (id, email, code_hash, purpose, expires_at, attempts, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)',
  ).run(newId(), normalized, sha256(`${normalized}:${code}`), purpose, expires, now)
  return code
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RegisterBody = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,20}$/, '用户名用 3–20 位字母、数字或下划线'),
  email: z.string().regex(EMAIL_RE, '邮箱格式不对'),
  password: z.string().min(8, '密码至少 8 位').max(128),
  isUnnc: z.boolean().optional().default(false),
})

const VerifyBody = z.object({
  email: z.string().regex(EMAIL_RE, '邮箱格式不对'),
  code: z.string().regex(/^\d{6}$/, '验证码是 6 位数字'),
})

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const ForgotBody = z.object({
  email: z.string().regex(EMAIL_RE, '邮箱格式不对'),
})

const ResetBody = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, '密码至少 8 位').max(128),
})

const ChangePasswordBody = z.object({
  current: z.string().min(1, '填一下当前密码'),
  next: z.string().min(8, '新密码至少 8 位').max(128),
})

const PolishBody = z.object({
  text: z.string().min(1, '先贴一段文字').max(8000, '一次最多 8000 字符'),
  context: z
    .object({
      recipient: z.string().max(40).optional(),
      relationship: z.string().max(40).optional(),
      formality: z.number().min(1).max(5).optional(),
      instruction: z.string().max(200).optional(),
    })
    .optional(),
})

const GenerateBody = z.object({
  purpose: z.string().max(30),
  fields: z
    .object({
      recipientRole: z.string().max(30).optional(),
      recipientName: z.string().max(60).optional(),
      salutation: z.string().max(120).optional(),
      firstContact: z.boolean().optional(),
      background: z.string().max(2000).optional(),
      ask: z.string().max(1000).optional(),
      reason: z.string().max(1000).optional(),
      checked: z.string().max(500).optional(),
      deadline: z.string().max(120).optional(),
      signature: z.string().max(80).optional(),
      formality: z.number().min(1).max(5).optional(),
    })
    .optional()
    .default({}),
})

// Signed-in quota is persisted; trial quota lives in memory. Either way the
// charge happens once, before the model call.
function charge(c: Context, user: UserRow | undefined): Response | null {
  if (user) {
    if (!consumeQuota(user)) return fail(c, 429, 'quota_exceeded', '今天的次数用完了')
    return null
  }
  if (!consumeTrial(clientIp(c))) {
    return fail(c, 429, 'trial_exceeded', '试用次数用完了，注册后可以继续')
  }
  return null
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    provider: env.llm.apiKey ? env.llm.model : 'mock',
    env: env.nodeEnv,
  }),
)

app.post('/api/auth/register', async (c) => {
  const body = await readBody(c, RegisterBody)
  if (body instanceof Response) return body
  const { username, email, password, isUnnc } = body
  const normalized = email.toLowerCase()

  if (!allow(`register:${normalized}`, 5, 3_600_000)) {
    return fail(c, 429, 'rate_limited', '这个邮箱注册太频繁了，过一会儿再试')
  }

  const existing = findUserByEmail(normalized)
  if (existing?.email_verified_at) return fail(c, 409, 'email_taken', '这个邮箱已经注册过了')

  const passwordHash = await hashPassword(password)
  const now = nowIso()

  if (existing) {
    // Registered before but never verified: let the same address finish.
    db.prepare('UPDATE users SET password_hash = ?, is_unnc = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      isUnnc ? 1 : 0,
      now,
      existing.id,
    )
  } else {
    if (findUserByUsername(username)) return fail(c, 409, 'username_taken', '这个用户名已经被用了')
    db.prepare(
      'INSERT INTO users (id, username, email, password_hash, email_verified_at, is_unnc, quota_day, quota_used, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)',
    ).run(newId(), username, normalized, passwordHash, isUnnc ? 1 : 0, '', now, now)
  }

  const code = issueCode(normalized, 'verify')

  // A dead mail server must not fail the registration: the account and the code
  // already exist, and the user can ask for a new one. Only the delivery flag
  // changes, so the page can say "couldn't send" instead of showing a network error.
  let delivered = true
  try {
    await mailer.sendVerificationCode(normalized, code)
  } catch (error) {
    delivered = false
    console.error('[register] verification mail failed', error)
  }

  return c.json({ ok: true, delivered, devCode: isDev ? code : undefined })
})

app.post('/api/auth/verify-email', async (c) => {
  const body = await readBody(c, VerifyBody)
  if (body instanceof Response) return body
  const normalized = body.email.toLowerCase()

  if (!allow(`verify:${normalized}`, 10, 600_000)) {
    return fail(c, 429, 'rate_limited', '尝试次数太多了，过一会儿再试')
  }

  // The newest code decides the answer, whether or not it is still usable.
  // Looking only at unconsumed rows used to fall back to an older, locked one
  // and report "too many attempts" for a code the user had already used.
  const row = db
    .prepare(
      "SELECT * FROM email_codes WHERE email = ? AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1",
    )
    .get(normalized) as
    | { id: string; code_hash: string; expires_at: string; attempts: number; consumed_at: string | null }
    | undefined

  if (!row) return fail(c, 400, 'code_missing', '先获取验证码')
  if (row.consumed_at) {
    return fail(c, 400, 'code_used', '这个验证码已经失效，重新获取一个')
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return fail(c, 400, 'code_expired', '验证码过期了，重新获取一个')
  }
  if (row.attempts >= 5) return fail(c, 429, 'code_locked', '试错太多次，重新获取一个')
  if (row.code_hash !== sha256(`${normalized}:${body.code}`)) {
    db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id)
    return fail(c, 400, 'code_wrong', '验证码不对')
  }

  const now = nowIso()
  db.prepare('UPDATE email_codes SET consumed_at = ? WHERE id = ?').run(now, row.id)
  db.prepare('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE email = ?').run(
    now,
    now,
    normalized,
  )

  return c.json({ ok: true })
})

app.post('/api/auth/login', async (c) => {
  const body = await readBody(c, LoginBody)
  if (body instanceof Response) return body
  const { username, password } = body

  if (!allow(`login:${username.toLowerCase()}`, 5, 15 * 60_000)) {
    return fail(c, 429, 'too_many_attempts', '尝试次数过多，15 分钟后再试')
  }

  const user = findUserByUsername(username)
  const valid = user ? await verifyPassword(user.password_hash, password) : false
  if (!user || !valid) return fail(c, 401, 'invalid_credentials', '用户名或密码错误')
  if (!user.email_verified_at) return fail(c, 403, 'email_unverified', '邮箱还没验证')

  const { token, expires } = createSession(user.id, c.req.header('user-agent'))
  setSessionCookie(c, token, expires)
  return c.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) destroySession(token)
  clearSessionCookie(c)
  return c.json({ ok: true })
})

/**
 * Always answers the same way, whether or not the address has an account.
 * Anything else turns this endpoint into a way to enumerate users.
 */
app.post('/api/auth/forgot', async (c) => {
  const body = await readBody(c, ForgotBody)
  if (body instanceof Response) return body

  const email = body.email.toLowerCase()
  if (!allow(`forgot:${email}`, 5, 3_600_000) || !allow(`forgot-ip:${clientIp(c)}`, 20, 3_600_000)) {
    return fail(c, 429, 'rate_limited', '请求太频繁，过一会儿再试')
  }

  const user = findUserByEmail(email)
  if (user) {
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + 30 * 60_000).toISOString()

    db.prepare(
      'INSERT INTO password_resets (id, user_id, token_hash, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
    ).run(newId(), user.id, sha256(token), expires, nowIso())

    try {
      await mailer.sendPasswordReset(email, token)
    } catch (error) {
      // The address's owner is not told about an infrastructure failure here;
      // the log is the only place it belongs.
      console.error('[forgot]', error)
    }
  }

  return c.json({ ok: true })
})

app.post('/api/auth/reset', async (c) => {
  const body = await readBody(c, ResetBody)
  if (body instanceof Response) return body

  if (!allow(`reset:${clientIp(c)}`, 10, 600_000)) {
    return fail(c, 429, 'rate_limited', '尝试太频繁，过一会儿再试')
  }

  const row = db
    .prepare('SELECT id, user_id, expires_at, consumed_at FROM password_resets WHERE token_hash = ?')
    .get(sha256(body.token)) as
    | { id: string; user_id: string; expires_at: string; consumed_at: string | null }
    | undefined

  if (!row) return fail(c, 400, 'token_invalid', '这个链接不对，重新申请一次')
  if (row.consumed_at) return fail(c, 400, 'token_used', '这个链接已经用过了，重新申请一次')
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return fail(c, 400, 'token_expired', '链接过期了，重新申请一次')
  }

  const now = nowIso()
  const passwordHash = await hashPassword(body.password)

  db.prepare('UPDATE password_resets SET consumed_at = ? WHERE id = ?').run(now, row.id)
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    passwordHash,
    now,
    row.user_id,
  )
  // Whoever reset the password may not be the person holding the old sessions.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id)

  return c.json({ ok: true })
})

app.post('/api/auth/password', requireAuth, async (c) => {
  const body = await readBody(c, ChangePasswordBody)
  if (body instanceof Response) return body

  const user = c.get('user')!
  const valid = await verifyPassword(user.password_hash, body.current)
  if (!valid) return fail(c, 400, 'wrong_password', '当前密码不对')

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    await hashPassword(body.next),
    nowIso(),
    user.id,
  )

  // Keep this session, drop the rest.
  const token = getCookie(c, SESSION_COOKIE) ?? ''
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(
    user.id,
    sha256(token),
  )

  return c.json({ ok: true })
})

app.get('/api/auth/me', requireAuth, (c) => {
  const user = c.get('user')!
  return c.json({
    user: publicUser(user),
    quota: { used: user.quota_used, limit: env.quota.userPerDay },
  })
})

// Self-declared, and the only place it can change after registration.
app.post('/api/auth/unnc', requireAuth, async (c) => {
  const body = await readBody(c, z.object({ isUnnc: z.boolean() }))
  if (body instanceof Response) return body

  const user = c.get('user')!
  db.prepare('UPDATE users SET is_unnc = ?, updated_at = ? WHERE id = ?').run(
    body.isUnnc ? 1 : 0,
    nowIso(),
    user.id,
  )

  return c.json({ isUnnc: body.isUnnc })
})

app.post('/api/polish', optionalAuth, async (c) => {
  const body = await readBody(c, PolishBody)
  if (body instanceof Response) return body

  const user = c.get('user')
  const denied = charge(c, user)
  if (denied) return denied

  try {
    const out = await runPolish(body.text, body.context ?? {})
    return c.json({ ...out, trial: !user })
  } catch (error) {
    console.error('[polish]', error)
    return fail(c, 502, 'model_failed', '模型暂时没响应，稍后再试')
  }
})

app.post('/api/generate', optionalAuth, async (c) => {
  const body = await readBody(c, GenerateBody)
  if (body instanceof Response) return body

  const fields = body.fields as GenerateFields
  if (!fields.ask?.trim() && !fields.background?.trim()) {
    return fail(c, 400, 'invalid_input', '至少写一点背景，或者你希望对方做什么')
  }

  const user = c.get('user')
  const denied = charge(c, user)
  if (denied) return denied

  try {
    const out = await runGenerate(body.purpose, fields)
    return c.json({ ...out, trial: !user })
  } catch (error) {
    console.error('[generate]', error)
    return fail(c, 502, 'model_failed', '模型暂时没响应，稍后再试')
  }
})

app.route('/api', learn)
app.route('/api', people)

app.notFound((c) => c.json({ error: 'not_found' }, 404))

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`roboemail server  http://127.0.0.1:${info.port}`)
  console.log(`provider            ${env.llm.apiKey ? env.llm.model : 'mock (no LLM_API_KEY)'}`)
})
