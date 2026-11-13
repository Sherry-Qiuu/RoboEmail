import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { db, newId, nowIso } from './db.ts'

const SEED_FILE = resolve(import.meta.dirname, '../data/professors.json')

export type ProfessorRow = {
  id: string
  name_en: string
  surname: string
  title: string
  role: string | null
  school: string | null
  department: string | null
  email: string | null
  profile_url: string | null
  salutation_override: string | null
  updated_at: string | null
}

/**
 * Ranks that students get wrong. Associate and Assistant Professors are "Dr"
 * in British usage; only a chair is "Professor".
 */
const PROFESSOR_TITLES = new Set(['教授', '讲座教授', '访问教授', '荣誉教授', '系主任', '院长'])

const DOCTOR_TITLES = new Set([
  '副教授',
  '助理教授',
  '访问副教授',
  '访问助理教授',
  '荣誉副教授',
  '研究员',
  '高级研究员',
  '首席研究员',
  '教学研究员',
  '访问教学研究员',
  '博士后研究员',
  '导师',
  '高级导师',
])

const PARENTHETICAL = /\s*\([^)]*\)/g

export function salutationFor(row: {
  title: string
  surname: string
  name_en: string
  salutation_override?: string | null
}): string {
  const override = row.salutation_override?.trim()
  if (override) return override

  if (PROFESSOR_TITLES.has(row.title)) return `Dear Professor ${row.surname},`
  if (DOCTOR_TITLES.has(row.title)) return `Dear Dr ${row.surname},`

  // Professional services have no academic title and no reliable gender, so
  // the full name is the only polite, unambiguous option.
  return `Dear ${row.name_en.replace(PARENTHETICAL, '').trim()},`
}

export function toPublic(row: ProfessorRow) {
  return {
    id: row.id,
    nameEn: row.name_en,
    surname: row.surname,
    title: row.title,
    role: row.role ?? '',
    school: row.school ?? '',
    department: row.department ?? '',
    email: row.email ?? '',
    profileUrl: row.profile_url ?? '',
    salutation: salutationFor(row),
    updatedAt: row.updated_at ?? '',
  }
}

export function searchProfessors(query: string, limit = 8): ProfessorRow[] {
  const like = `%${query.toLowerCase()}%`
  return db
    .prepare(
      `SELECT * FROM professors
       WHERE lower(name_en) LIKE ? OR lower(surname) LIKE ?
          OR lower(department) LIKE ? OR lower(email) LIKE ?
       ORDER BY name_en
       LIMIT ?`,
    )
    .all(like, like, like, like, limit) as ProfessorRow[]
}

export function listProfessors(limit = 1000): ProfessorRow[] {
  return db
    .prepare('SELECT * FROM professors ORDER BY name_en LIMIT ?')
    .all(limit) as ProfessorRow[]
}

export function countProfessors(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM professors').get() as { n: number }
  return row.n
}

type SeedRow = {
  nameEn: string
  surname: string
  titleCn: string
  titleEn?: string
  school?: string
  department?: string
  email?: string | null
  profileUrl?: string | null
  sourceUrl?: string | null
}

/**
 * The directory ships with the app as JSON. A fresh database has an empty
 * table, so import it once on boot instead of asking the operator to run a
 * script by hand — that step is easy to forget and silently leaves the page
 * blank.
 */
export function seedProfessors(): number {
  const existing = countProfessors()
  if (existing > 0) return existing

  let rows: SeedRow[]
  try {
    rows = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedRow[]
  } catch (error) {
    console.warn('[professors] seed file unreadable:', (error as Error).message)
    return 0
  }

  const insert = db.prepare(
    `INSERT INTO professors
       (id, name_en, surname, name_zh, name_pinyin, title, salutation_override,
        school, department, email, role, modules, profile_url, source_url, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  )

  const seen = new Set<string>()
  const now = nowIso()
  let added = 0

  db.exec('BEGIN')
  try {
    for (const row of rows) {
      const email = row.email ?? null
      if (email) {
        if (seen.has(email)) continue
        seen.add(email)
      }
      insert.run(
        newId(),
        row.nameEn,
        row.surname,
        row.titleCn,
        row.school ?? null,
        row.department || null,
        email,
        row.titleEn || null,
        row.profileUrl ?? null,
        row.sourceUrl ?? null,
        now,
      )
      added += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    console.warn('[professors] seed failed:', (error as Error).message)
    return countProfessors()
  }

  console.log(`[professors] seeded ${added} rows from ${SEED_FILE}`)
  return added
}
