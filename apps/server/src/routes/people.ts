import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { requireAuth, type AppEnv } from '../auth.ts'
import {
  countProfessors,
  findProfessorById,
  listProfessors,
  searchProfessors,
  toPublic,
} from '../professors.ts'
import { photoPath, profileFor, toPublicProfile } from '../profiles.ts'

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

/**
 * Detail card for the modal. A directory row can exist without a profile (the
 * two datasets cover different sets of people), so "no profile" is a normal
 * answer rather than an error.
 */
people.get('/professors/:id/profile', requireAuth, (c) => {
  const user = c.get('user')!
  if (!user.is_unnc) return c.json({ error: 'forbidden' }, 403)

  const row = findProfessorById(c.req.param('id'))
  if (!row) return c.json({ error: 'not_found' }, 404)

  const profile = profileFor(row)
  return c.json({ profile: profile ? toPublicProfile(profile, row.id) : null })
})

people.get('/professors/:id/photo', requireAuth, (c) => {
  const user = c.get('user')!
  if (!user.is_unnc) return c.json({ error: 'forbidden' }, 403)

  const row = findProfessorById(c.req.param('id'))
  const profile = row ? profileFor(row) : null
  const file = profile ? photoPath(profile) : null
  if (!file) return c.json({ error: 'not_found' }, 404)

  const bytes = readFileSync(file)
  // Buffer is a view into a shared pool, so hand over exactly its own bytes.
  const start = bytes.byteOffset
  const body = bytes.buffer.slice(start, start + bytes.byteLength) as ArrayBuffer
  return c.body(body, 200, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=86400',
  })
})
