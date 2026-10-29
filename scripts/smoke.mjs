/**
 * End-to-end smoke test against a throwaway database.
 *
 * Starts the real server on its own port and file, walks the main paths, then
 * deletes the file. No SMTP and no model key: the console mailer and the mock
 * provider keep it offline and free.
 *
 *   node scripts/smoke.mjs
 */

import { spawn } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'

const root = resolve(import.meta.dirname, '..')
const port = process.env.SMOKE_PORT ?? '8899'
const dbName = 'smoke.db'
const dbPath = join(root, 'apps/server/data', dbName)
const base = `http://127.0.0.1:${port}`

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed += 1
}

function resetDatabase() {
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(dbPath + suffix, { force: true })
  }
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms))
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) return true
    } catch {
      // not listening yet
    }
    await sleep(250)
  }
  return false
}

/** The throwaway database starts empty; the directory needs rows to be useful. */
function seedProfessors() {
  const rows = JSON.parse(
    readFileSync(join(root, 'apps/server/data/professors.json'), 'utf8'),
  )
  const db = new DatabaseSync(dbPath)
  const insert = db.prepare(
    `INSERT INTO professors
       (id, name_en, surname, name_zh, name_pinyin, title, salutation_override,
        school, department, email, role, modules, profile_url, source_url, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  )
  const now = new Date().toISOString()
  for (const row of rows) {
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
  }
  db.close()
  return rows.length
}

let cookie = ''

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = response.headers.getSetCookie?.() ?? []
  if (setCookie.length > 0) cookie = setCookie[0].split(';')[0]
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, payload }
}

resetDatabase()

const server = spawn(process.execPath, ['src/index.ts'], {
  cwd: join(root, 'apps/server'),
  env: {
    ...process.env,
    PORT: port,
    DB_PATH: `data/${dbName}`,
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    LLM_API_KEY: '',
    NODE_ENV: 'development',
  },
  stdio: 'ignore',
})

async function stop() {
  server.kill()
  await sleep(300)
  resetDatabase()
}

try {
  if (!(await waitForServer())) {
    console.error('server did not start')
    await stop()
    process.exit(1)
  }

  const health = await call('/api/health')
  check('health', health.status === 200 && health.payload.provider === 'mock')

  const seeded = seedProfessors()
  check('professor seed', seeded > 0, `${seeded} rows`)

  const email = 'smoke@example.com'
  const password = 'smokepass123'
  const registered = await call('/api/auth/register', {
    method: 'POST',
    body: { username: 'smoke', email, password, isUnnc: false },
  })
  check(
    'register returns a code',
    registered.status === 200 && registered.payload.delivered === true,
    `delivered=${registered.payload.delivered}`,
  )

  const code = registered.payload.devCode
  const verified = await call('/api/auth/verify-email', {
    method: 'POST',
    body: { email, code },
  })
  check('verify email', verified.status === 200)

  const replay = await call('/api/auth/verify-email', { method: 'POST', body: { email, code } })
  check('replayed code rejected', replay.payload.error === 'code_used', replay.payload.error)

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { username: 'smoke', password },
  })
  check('login', login.status === 200 && Boolean(cookie))

  const me = await call('/api/auth/me')
  check('session works', me.status === 200 && me.payload.user.username === 'smoke')

  await call('/api/auth/unnc', { method: 'POST', body: { isUnnc: true } })
  const people = await call('/api/professors?q=Chen')
  check(
    'professor search',
    people.status === 200 && people.payload.total > 0 && people.payload.items.length > 0,
    `total=${people.payload.total} hits=${people.payload.items.length}`,
  )

  const polished = await call('/api/polish', {
    method: 'POST',
    body: { text: 'Dear Professor Chen, I want to ask about the deadline. Can you tell me?' },
  })
  check(
    'polish returns changes',
    polished.status === 200 && polished.payload.result.changes.length > 0,
    `changes=${polished.payload.result.changes.length}`,
  )

  const generated = await call('/api/generate', {
    method: 'POST',
    body: {
      purpose: 'inquiry',
      fields: { background: 'deadline unclear', ask: 'confirm the date' },
    },
  })
  check(
    'generate returns paragraphs',
    generated.status === 200 && generated.payload.result.paragraphs.length > 0,
  )

  const reported = await call('/api/errors/batch', {
    method: 'POST',
    body: {
      items: [
        { category: 'grammar.plural', before: 'informations', after: 'information', explanation_zh: '不可数' },
      ],
    },
  })
  check('errors accepted', reported.payload.added === 1, `added=${reported.payload.added}`)

  const insights = await call('/api/insights')
  check('insights counted', insights.payload.total === 1)

  const errorId = insights.payload.items[0]?.id
  const mastered = await call(`/api/errors/${errorId}/mastered`, { method: 'POST' })
  check('mark mastered', mastered.payload.mastered === true)

  const forgot = await call('/api/auth/forgot', { method: 'POST', body: { email } })
  check('forgot answers ok', forgot.status === 200 && forgot.payload.ok === true)

  // The mail carries a token we can never read back, so the reset test uses one
  // written straight into the throwaway database.
  const token = 'smoke-token-0123456789abcdef'
  const db = new DatabaseSync(dbPath)
  const owner = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  db.prepare(
    'INSERT INTO password_resets (id, user_id, token_hash, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
  ).run(
    randomUUID(),
    owner.id,
    createHash('sha256').update(token).digest('hex'),
    new Date(Date.now() + 30 * 60_000).toISOString(),
    new Date().toISOString(),
  )
  db.close()

  const reset = await call('/api/auth/reset', {
    method: 'POST',
    body: { token, password: 'newsmokepass456' },
  })
  check('reset password', reset.status === 200)

  const reuse = await call('/api/auth/reset', {
    method: 'POST',
    body: { token, password: 'another789' },
  })
  check('reset token single use', reuse.payload.error === 'token_used', reuse.payload.error)

  const oldLogin = await call('/api/auth/login', { method: 'POST', body: { username: 'smoke', password } })
  check('old password rejected', oldLogin.status === 401)

  const newLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { username: 'smoke', password: 'newsmokepass456' },
  })
  check('new password works', newLogin.status === 200)
} catch (error) {
  console.error('smoke run threw:', error)
  failed += 1
} finally {
  await stop()
}

console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`)
process.exit(failed === 0 ? 0 : 1)
