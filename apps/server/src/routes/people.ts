import { Hono } from 'hono'
import { requireAuth, type AppEnv } from '../auth.ts'
import { countProfessors, listProfessors, searchProfessors, toPublic } from '../professors.ts'

export const people = new Hono<AppEnv>()

/**
 * The staff directory is public information, but the feature is scoped to
 * students who said they are at UNNC, so an empty list is the honest answer
 * for everyone else.
 */
people.get('/professors', requireAuth, (c) => {
  const user = c.get('user')!
  if (!user.is_unnc) return c.json({ items: [], total: 0 })

  const query = (c.req.query('q') ?? '').trim()
  const rows = query.length === 0 ? listProfessors() : searchProfessors(query)

  return c.json({ items: rows.map(toPublic), total: countProfessors() })
})
