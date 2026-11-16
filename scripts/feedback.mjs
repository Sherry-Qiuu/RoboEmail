/**
 * Read the suggestion box without an admin panel.
 *
 *   node scripts/feedback.mjs              latest 20
 *   node scripts/feedback.mjs --unread     only the ones not handled yet
 *   node scripts/feedback.mjs --done 12    mark number 12 as handled
 *   node scripts/feedback.mjs --json       machine readable
 *
 * Run it on the server, where the database lives. Set DB_PATH to point
 * somewhere else (defaults to apps/server/data/roboemail.db).
 */

import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dbPath = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : join(root, 'apps/server/data/roboemail.db')

if (!existsSync(dbPath)) {
  console.error(`database not found: ${dbPath}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const unreadOnly = args.includes('--unread')

const doneIndex = args.indexOf('--done')
const doneId = doneIndex >= 0 ? args[doneIndex + 1] : undefined

const db = new DatabaseSync(dbPath, { readOnly: doneId ? false : true })

if (doneId) {
  const result = db
    .prepare('UPDATE feedback SET handled_at = ? WHERE id = ?')
    .run(new Date().toISOString(), doneId)
  if (result.changes === 0) {
    console.error(`no feedback with id ${doneId}`)
    process.exit(1)
  }
  console.log(`marked ${doneId} as handled`)
  db.close()
  process.exit(0)
}

const rows = db
  .prepare(
    `SELECT f.id, f.kind, f.rating, f.page, f.version, f.title, f.body,
            f.contact_ok, f.handled_at, f.created_at, u.username
       FROM feedback f
       JOIN users u ON u.id = f.user_id
      ${unreadOnly ? 'WHERE f.handled_at IS NULL' : ''}
      ORDER BY f.created_at DESC
      LIMIT 20`,
  )
  .all()

db.close()

if (asJson) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

if (rows.length === 0) {
  console.log(unreadOnly ? '没有未处理的反馈' : '还没有反馈')
  process.exit(0)
}

for (const row of rows) {
  const when = row.created_at.replace('T', ' ').slice(0, 16)
  const rating = row.rating === 1 ? '有用' : row.rating === 0 ? '没用' : '—'
  const flag = row.handled_at ? '已处理' : '未处理'
  console.log('─'.repeat(64))
  console.log(`${when}  ${row.page || '未知页面'}  v${row.version || '?'}  ${row.username}`)
  console.log(`评分 ${rating} · ${flag} · id ${row.id}`)
  if (row.title) console.log(`标题 ${row.title}`)
  if (row.body) console.log(`\n${row.body}`)
  if (row.contact_ok) console.log('\n（用户同意回复）')
}

console.log('─'.repeat(64))
console.log(`${rows.length} 条 · 用 --done <id> 标记已处理`)
