import { DatabaseSync } from 'node:sqlite'
import { env, ensureDirFor } from './env.ts'

ensureDirFor(env.dbPath)

export const db = new DatabaseSync(env.dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  username          TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  email_verified_at TEXT,
  is_unnc           INTEGER NOT NULL DEFAULT 0,
  quota_day         TEXT NOT NULL DEFAULT '',
  quota_used        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS email_codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS errors (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  before         TEXT NOT NULL,
  after          TEXT NOT NULL,
  explanation_zh TEXT NOT NULL,
  source_label   TEXT,
  source_date    TEXT,
  mastered       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS professors (
  id                  TEXT PRIMARY KEY,
  name_en             TEXT NOT NULL,
  surname             TEXT NOT NULL,
  name_zh             TEXT,
  name_pinyin         TEXT,
  title               TEXT NOT NULL,
  salutation_override TEXT,
  school              TEXT,
  department          TEXT,
  email               TEXT UNIQUE,
  role                TEXT,
  modules             TEXT,
  profile_url         TEXT,
  source_url          TEXT,
  updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS professor_reports (
  id           TEXT PRIMARY KEY,
  professor_id TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  note         TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_errors_user ON errors(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_errors_dedupe ON errors(user_id, before, after);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_codes_email ON email_codes(email, purpose, created_at);
`)

export type UserRow = {
  id: string
  username: string
  email: string
  password_hash: string
  email_verified_at: string | null
  is_unnc: number
  quota_day: string
  quota_used: number
  created_at: string
  updated_at: string
}

export const nowIso = (): string => new Date().toISOString()
export const newId = (): string => crypto.randomUUID()

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
    .get(username) as UserRow | undefined
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    .get(email) as UserRow | undefined
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isUnnc: Boolean(user.is_unnc),
    verified: Boolean(user.email_verified_at),
  }
}
