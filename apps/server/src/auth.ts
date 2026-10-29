import { createHash, randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { db, findUserById, newId, nowIso, type UserRow } from './db.ts'
import { env } from './env.ts'

export type AppEnv = {
  Variables: {
    user?: UserRow
  }
}

export const SESSION_COOKIE = 'sid'
const SESSION_DAYS = 30

export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password)
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

export function createSession(
  userId: string,
  userAgent?: string,
): { token: string; expires: Date } {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(newId(), userId, sha256(token), expires.toISOString(), nowIso(), userAgent ?? null)
  return { token, expires }
}

export function destroySession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
}

export function userFromRequest(c: Context): UserRow | undefined {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return undefined
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(sha256(token)) as { user_id: string; expires_at: string } | undefined
  if (!row) return undefined
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
    return undefined
  }
  return findUserById(row.user_id)
}

export function setSessionCookie(c: Context, token: string, expires: Date): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.nodeEnv === 'production',
    path: '/',
    expires,
  })
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = userFromRequest(c)
  if (user) c.set('user', user)
  await next()
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = userFromRequest(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', user)
  await next()
}

// Signed-in quota is persisted per user. Trial quota is in memory on purpose:
// trial usage must leave no record behind.
export function consumeQuota(user: UserRow): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const used = user.quota_day === today ? user.quota_used : 0
  if (used >= env.quota.userPerDay) return false
  db.prepare('UPDATE users SET quota_day = ?, quota_used = ? WHERE id = ?').run(
    today,
    used + 1,
    user.id,
  )
  user.quota_day = today
  user.quota_used = used + 1
  return true
}

const trialHits = new Map<string, { day: string; used: number }>()

export function consumeTrial(ip: string): boolean {
  const today = new Date().toISOString().slice(0, 10)

  // The map only ever holds today's addresses; drop yesterday's when it grows.
  if (trialHits.size > 5000) {
    for (const [key, value] of trialHits) {
      if (value.day !== today) trialHits.delete(key)
    }
  }

  const hit = trialHits.get(ip)
  if (!hit || hit.day !== today) {
    trialHits.set(ip, { day: today, used: 1 })
    return true
  }
  if (hit.used >= env.quota.trialPerDay) return false
  hit.used += 1
  return true
}
