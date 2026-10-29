import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const appRoot = resolve(import.meta.dirname, '..')

// The shell wins over the file: a variable set for this process (a one-off
// PORT, or a production override) must not be replaced by whatever .env says.
const shellEnv = { ...process.env }

try {
  process.loadEnvFile(resolve(appRoot, '../../.env'))
} catch {
  // .env is optional
}

Object.assign(process.env, shellEnv)

const smtpUser = process.env.SMTP_USER ?? ''

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8787),
  dbPath: resolve(appRoot, process.env.DB_PATH ?? 'data/roboemail.db'),
  quota: {
    userPerDay: Number(process.env.QUOTA_USER_PER_DAY ?? 30),
    trialPerDay: Number(process.env.QUOTA_TRIAL_PER_DAY ?? 3),
  },
  llm: {
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
  },
  // Empty host means "no SMTP configured": mailer.ts then falls back to the
  // console implementation, so local development needs no credentials.
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 465),
    user: smtpUser,
    pass: process.env.SMTP_PASS ?? '',
    // Providers such as Gmail reject a sender that is not the login account, so
    // the account address is the default instead of a domain nobody owns.
    from: process.env.MAIL_FROM || `RoboEmail <${smtpUser || 'no-reply@localhost'}>`,
    // Needed where outbound port 465/587 is blocked: an HTTP proxy that supports
    // CONNECT gets the mail out. Empty means a direct connection.
    proxy: process.env.SMTP_PROXY ?? '',
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS ?? 15_000),
  },
  appOrigin: (process.env.APP_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, ''),
}

export const isDev = env.nodeEnv !== 'production'

export function ensureDirFor(file: string): void {
  mkdirSync(dirname(file), { recursive: true })
}
