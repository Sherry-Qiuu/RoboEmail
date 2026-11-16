import { env } from './env.ts'
import { createSmtpMailer } from './mailer/smtp.ts'

/** What the owner receives when someone submits a suggestion. */
export type FeedbackMail = {
  username: string
  page: string
  version: string
  rating?: number
  title: string
  body: string
  contactOk: boolean
}

/**
 * The only surface the SMTP work needs. Implementations must not touch the
 * database; they receive a plain recipient plus the secret to deliver.
 */
export interface Mailer {
  sendVerificationCode(to: string, code: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
  sendFeedback(to: string, note: FeedbackMail): Promise<void>
}

export const consoleMailer: Mailer = {
  async sendVerificationCode(to, code): Promise<void> {
    console.log(`[mailer:console] verification code  to=${to}  code=${code}`)
  },
  async sendPasswordReset(to, token): Promise<void> {
    console.log(`[mailer:console] password reset link  to=${to}  token=${token}`)
  },
  async sendFeedback(to, note): Promise<void> {
    console.log(
      `[mailer:console] feedback  to=${to}  page=${note.page}  title=${note.title}  body=${note.body.slice(0, 80)}`,
    )
  },
}

// SMTP needs a host and credentials. Half a configuration would quietly log
// codes that nobody can read, so production refuses to start like that; in
// development it warns and keeps working on the console mailer.
const smtpConfigured = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass)

if (env.smtp.host && !smtpConfigured) {
  const detail = 'SMTP_HOST is set but SMTP_USER or SMTP_PASS is empty'
  if (env.nodeEnv === 'production') throw new Error(detail)
  console.warn(`[mailer] ${detail}; falling back to the console mailer`)
}

export const mailer: Mailer = smtpConfigured
  ? createSmtpMailer(env.smtp, env.appOrigin)
  : consoleMailer
