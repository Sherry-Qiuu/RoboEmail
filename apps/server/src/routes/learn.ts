import { Hono } from 'hono'
import { z } from 'zod'
import { db, newId, nowIso } from '../db.ts'
import { requireAuth, type AppEnv } from '../auth.ts'
import { fail, readBody } from '../http.ts'

export const learn = new Hono<AppEnv>()

const ItemSchema = z.object({
  category: z.string().min(1).max(40),
  before: z.string().min(1).max(200),
  after: z.string().min(1).max(200),
  explanation_zh: z.string().max(400).default(''),
  source_label: z.string().max(40).optional(),
})

const BatchSchema = z.object({ items: z.array(ItemSchema).max(50) })

type ErrorRow = {
  id: string
  category: string
  before: string
  after: string
  explanation_zh: string
  source_label: string | null
  mastered: number
  created_at: string
}

/**
 * Errors arrive in batches after a polish call. The same wrong form often
 * comes back more than once, so an identical (before, after) pair is stored
 * once and the repeat is dropped.
 */
learn.post('/errors/batch', requireAuth, async (c) => {
  const body = await readBody(c, BatchSchema)
  if (body instanceof Response) return body

  const user = c.get('user')!
  const existing = db.prepare(
    'SELECT 1 FROM errors WHERE user_id = ? AND before = ? AND after = ? LIMIT 1',
  )
  const insert = db.prepare(
    'INSERT INTO errors (id, user_id, category, before, after, explanation_zh, source_label, source_date, mastered, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
  )

  const today = new Date().toISOString().slice(0, 10)
  let added = 0

  for (const item of body.items) {
    if (existing.get(user.id, item.before, item.after)) continue
    insert.run(
      newId(),
      user.id,
      item.category,
      item.before,
      item.after,
      item.explanation_zh,
      item.source_label ?? null,
      today,
      nowIso(),
    )
    added += 1
  }

  return c.json({ added })
})

learn.get('/insights', requireAuth, (c) => {
  const user = c.get('user')!

  const totals = db
    .prepare(
      'SELECT COUNT(*) AS total, SUM(mastered) AS mastered FROM errors WHERE user_id = ?',
    )
    .get(user.id) as { total: number; mastered: number | null }

  const byCategory = db
    .prepare(
      'SELECT category, COUNT(*) AS n FROM errors WHERE user_id = ? GROUP BY category ORDER BY n DESC',
    )
    .all(user.id) as { category: string; n: number }[]

  const since = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
  const rows = db
    .prepare(
      'SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM errors WHERE user_id = ? AND created_at >= ? GROUP BY day',
    )
    .all(user.id, since) as { day: string; n: number }[]

  const counts = new Map(rows.map((row) => [row.day, row.n]))
  const daily = Array.from({ length: 7 }, (_unused, index) => {
    const day = new Date(Date.now() - (6 - index) * 86_400_000).toISOString().slice(0, 10)
    return { day, n: counts.get(day) ?? 0 }
  })

  const items = db
    .prepare(
      'SELECT id, category, before, after, explanation_zh, source_label, mastered, created_at FROM errors WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
    )
    .all(user.id) as ErrorRow[]

  return c.json({
    total: totals.total ?? 0,
    mastered: totals.mastered ?? 0,
    byCategory,
    daily,
    items,
  })
})

learn.post('/errors/:id/mastered', requireAuth, (c) => {
  const user = c.get('user')!
  const id = c.req.param('id')

  const row = db
    .prepare('SELECT mastered FROM errors WHERE id = ? AND user_id = ?')
    .get(id, user.id) as { mastered: number } | undefined

  if (!row) return fail(c, 404, 'not_found', '这条记录不存在')

  const next = row.mastered ? 0 : 1
  db.prepare('UPDATE errors SET mastered = ? WHERE id = ?').run(next, id)
  return c.json({ mastered: Boolean(next) })
})
