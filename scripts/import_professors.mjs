import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const root = resolve(import.meta.dirname, '..')
const jsonPath = resolve(root, 'apps/server/data/professors.json')
const dbPath = resolve(root, 'apps/server/data/roboemail.db')

const rows = JSON.parse(readFileSync(jsonPath, 'utf8'))
const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')

const insert = db.prepare(
  `INSERT INTO professors
     (id, name_en, surname, name_zh, name_pinyin, title, salutation_override,
      school, department, email, role, modules, profile_url, source_url, updated_at)
   VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)`,
)

const seenEmails = new Set()
const now = new Date().toISOString()
let inserted = 0
let skipped = 0

db.exec('BEGIN')
try {
  db.exec('DELETE FROM professors')

  for (const row of rows) {
    if (row.email) {
      if (seenEmails.has(row.email)) {
        skipped += 1
        continue
      }
      seenEmails.add(row.email)
    }

    insert.run(
      randomUUID(),
      row.nameEn,
      row.surname,
      row.titleCn,
      row.school,
      row.department || null,
      row.email ?? null,
      row.titleEn || null,
      row.profileUrl ?? null,
      row.sourceUrl ?? null,
      now,
    )
    inserted += 1
  }

  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  console.error('import failed:', error.message)
  process.exit(1)
}

console.log(`imported ${inserted} professors, skipped ${skipped} duplicate emails`)
