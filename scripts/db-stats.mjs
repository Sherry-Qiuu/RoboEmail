/**
 * Prints row counts for the local database. Read-only; safe to run any time.
 *
 *   node scripts/db-stats.mjs
 */

import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'

const path = process.argv[2] ?? resolve(import.meta.dirname, '../apps/server/data/roboemail.db')
const db = new DatabaseSync(path, { readOnly: true })
const one = (sql) => db.prepare(sql).get().n

const today = new Date().toISOString().slice(0, 10)

console.log(`db: ${path}`)
console.log(`  注册账号        ${one('SELECT COUNT(*) AS n FROM users')}`)
console.log(`  已验证邮箱      ${one('SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NOT NULL')}`)
console.log(`  勾选 UNNC       ${one('SELECT COUNT(*) AS n FROM users WHERE is_unnc = 1')}`)
console.log(`  今日注册        ${one(`SELECT COUNT(*) AS n FROM users WHERE created_at >= '${today}'`)}`)
console.log(`  活跃会话        ${one('SELECT COUNT(*) AS n FROM sessions')}`)
console.log(`  错题记录        ${one('SELECT COUNT(*) AS n FROM errors')}`)
console.log(`  教授库          ${one('SELECT COUNT(*) AS n FROM professors')}`)

db.close()
