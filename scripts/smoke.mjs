/**
 * End-to-end smoke test against a throwaway database.
 *
 * Starts the real server on its own port and file, walks the main paths, then
 * deletes the file. No SMTP and no model key: the console mailer and the mock
 * provider keep it offline and free.
 *
 *   node scripts/smoke.mjs
 */

import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import net from 'node:net'

const root = resolve(import.meta.dirname, '..')

/** Ask the OS for a free port: a fixed one collides with whatever else is running. */
function freePort() {
  return new Promise((done, fail) => {
    const server = net.createServer()
    server.on('error', fail)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const chosen = typeof address === 'object' && address ? address.port : 0
      server.close(() => done(chosen))
    })
  })
}

const port = process.env.SMOKE_PORT ?? String(await freePort())
// Unique per run: a file left behind by a killed run must not block the next one.
const dbName = `smoke-${process.pid}.db`
const dbPath = join(root, 'apps/server/data', dbName)
const base = `http://127.0.0.1:${port}`

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed += 1
}

function resetDatabase() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(dbPath + suffix, { force: true })
    } catch {
      // A stale file that a dead process still holds is harmless.
    }
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

/** The server seeds the directory itself on boot, so just wait for the rows. */
async function waitForDirectory() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const health = await call('/api/health')
    if (health.status === 200) {
      const probe = new DatabaseSync(dbPath, { readOnly: true })
      try {
        const row = probe.prepare('SELECT COUNT(*) AS n FROM professors').get()
        if (row.n > 0) return row.n
      } catch {
        // table not created yet
      } finally {
        probe.close()
      }
    }
    await sleep(250)
  }
  return 0
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

  // Nothing behind the door works without a session.
  const anonPolish = await call('/api/polish', {
    method: 'POST',
    body: { text: 'Dear Prof Chen, i want ask the deadline.' },
  })
  check(
    'polish requires sign-in',
    anonPolish.status === 401,
    `status=${anonPolish.status}`,
  )

  const anonGenerate = await call('/api/generate', {
    method: 'POST',
    body: { purpose: 'inquiry', fields: { ask: 'confirm the date' } },
  })
  check(
    'generate requires sign-in',
    anonGenerate.status === 401,
    `status=${anonGenerate.status}`,
  )

  const seeded = await waitForDirectory()
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

  // The rich profile is joined from the shipped bundle, not the database, so
  // check the join actually produces research and papers for a real person.
  let profileWithPapers = null
  for (const item of people.payload.items.slice(0, 8)) {
    const detail = await call(`/api/professors/${item.id}/profile`)
    if (detail.payload.profile?.papers?.length) {
      profileWithPapers = detail.payload.profile
      break
    }
  }
  check(
    'professor profile has papers',
    Boolean(profileWithPapers?.papers?.length),
    profileWithPapers ? `${profileWithPapers.papers.length} papers` : 'none found',
  )
  check(
    'profile paper links are usable',
    Boolean(profileWithPapers?.papers?.every((paper) => paper.doi || paper.pure)),
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
      purposes: ['inquiry', 'meeting'],
      fields: { background: 'deadline unclear', ask: 'confirm the date' },
    },
  })
  check(
    'generate returns paragraphs',
    generated.status === 200 && generated.payload.result.paragraphs.length > 0,
    `purposes=2 paragraphs=${generated.payload.result?.paragraphs?.length ?? 0}`,
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

  // Feedback: one-click ratings and written notes share a route, and the note
  // must actually land in the table the CLI reads.
  const rating = await call('/api/feedback', {
    method: 'POST',
    body: { rating: 1, page: 'polish', version: '1.0.0' },
  })
  check('feedback rating accepted', rating.status === 200, `status=${rating.status}`)

  const note = await call('/api/feedback', {
    method: 'POST',
    body: {
      page: 'write',
      version: '1.0.0',
      title: '称呼不对',
      body: '写给讲师的邮件应该用 Dr。',
      contactOk: true,
    },
  })
  check('feedback note accepted', note.status === 200, `status=${note.status}`)

  const emptyFeedback = await call('/api/feedback', { method: 'POST', body: {} })
  check('empty feedback rejected', emptyFeedback.status === 400, `status=${emptyFeedback.status}`)

  {
    const probe = new DatabaseSync(dbPath, { readOnly: true })
    const rows = probe
      .prepare("SELECT kind, rating FROM feedback WHERE kind IN ('rating','note')")
      .all()
    probe.close()
    check(
      'feedback stored',
      rows.length === 2 && rows.some((row) => row.kind === 'note'),
      `${rows.length} rows`,
    )
  }

  // The owner reads suggestions through the CLI, so it has to see the row too.
  {
    const cli = execFileSync(process.execPath, ['scripts/feedback.mjs'], {
      cwd: root,
      env: { ...process.env, DB_PATH: dbPath },
      encoding: 'utf8',
    })
    check('feedback cli lists the note', cli.includes('称呼不对'), cli.split('\n').length + ' lines')
  }

  // Usernames may be Chinese, and must stay unique regardless of case.
  const chinese = await call('/api/auth/register', {
    method: 'POST',
    body: { username: '张同学', email: 'zhang@example.com', password: 'zhangpass123', isUnnc: true },
  })
  check('chinese username accepted', chinese.status === 200, `status=${chinese.status}`)

  const duplicate = await call('/api/auth/register', {
    method: 'POST',
    body: { username: '张同学', email: 'dup@example.com', password: 'duppass12345', isUnnc: false },
  })
  check(
    'duplicate username rejected',
    duplicate.status === 409 && duplicate.payload.error === 'username_taken',
    `status=${duplicate.status}`,
  )

  const cased = await call('/api/auth/register', {
    method: 'POST',
    body: { username: 'SMOKE', email: 'case@example.com', password: 'casepass1234', isUnnc: false },
  })
  check(
    'username unique regardless of case',
    cased.status === 409 && cased.payload.error === 'username_taken',
    `status=${cased.status}`,
  )

  const tooShort = await call('/api/auth/register', {
    method: 'POST',
    body: { username: 'a', email: 'short@example.com', password: 'shortpass123', isUnnc: false },
  })
  check('short username rejected', tooShort.status === 400, `status=${tooShort.status}`)
} catch (error) {
  console.error('smoke run threw:', error)
  failed += 1
} finally {
  await stop()
}

console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`)
process.exit(failed === 0 ? 0 : 1)
