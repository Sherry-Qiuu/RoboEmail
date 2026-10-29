import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer'
import type { Mailer } from '../mailer.ts'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
  proxy: string
  timeoutMs: number
}

interface OutgoingMail {
  subject: string
  text: string
  html: string
}

type Purpose = 'verify' | 'reset'

// The copy lives here once and is reused by the text and the HTML body, so the
// two versions cannot drift apart.
const VERIFY_LEAD = '你的 RoboEmail 验证码是：'
const VERIFY_TTL = '10 分钟内有效。如果不是你本人操作，请忽略这封邮件。'
const RESET_LEAD = '有人（希望是你）为这个邮箱申请了重置 RoboEmail 密码。'
const RESET_HINT = '点下面的链接设置新密码：'
const RESET_TTL =
  '30 分钟内有效，且只能使用一次。不是你本人操作的话，请忽略这封邮件，你的密码不会被改动。'

// Logs are allowed to say who the mail went to and which kind it was, but never
// the whole secret: the last two characters are enough to match a send with the
// code the user typed.
const maskEmail = (address: string): string => {
  const [local = '', domain = ''] = address.split('@')
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(local.length - head.length, 1))}@${domain}`
}

const maskSecret = (secret: string): string => `**${secret.slice(-2)}`

// Plain text and a deliberately plain HTML twin. No template engine, no images,
// nothing that a corporate spam filter would like to argue with.
const wrapHtml = (body: string): string =>
  `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#1f2328;max-width:480px">${body}</div>`

function buildVerificationMail(code: string): OutgoingMail {
  const text = [VERIFY_LEAD, '', `    ${code}`, '', VERIFY_TTL].join('\n')

  const html = wrapHtml(
    `<p>${VERIFY_LEAD}</p>` +
      `<p style="font-size:32px;font-weight:600;letter-spacing:8px;margin:20px 0">${code}</p>` +
      `<p>${VERIFY_TTL}</p>`,
  )

  return { subject: 'RoboEmail 验证码', text, html }
}

function buildPasswordResetMail(appOrigin: string, token: string): OutgoingMail {
  const link = `${appOrigin}/reset?token=${encodeURIComponent(token)}`

  const text = [RESET_LEAD, '', RESET_HINT, link, '', RESET_TTL].join('\n')

  const html = wrapHtml(
    `<p>${RESET_LEAD}</p>` +
      `<p><a href="${link}" style="color:#0969da">设置新密码</a></p>` +
      `<p style="font-size:13px;color:#57606a;word-break:break-all">${link}</p>` +
      `<p>${RESET_TTL}</p>`,
  )

  return { subject: 'RoboEmail 重置密码', text, html }
}

// sendMail() has its own socket timeouts, but they only fire on idling sockets.
// This deadline guarantees the caller gets an error within the promised budget
// even when the server accepts the connection and then goes quiet.
async function withDeadline<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  work.catch(() => {}) // counted below by the race; keeps late failures quiet
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<never>((_, reject) => {
    const message = `${label} timed out after ${timeoutMs} ms`
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

export function createSmtpMailer(config: SmtpConfig, appOrigin: string): Mailer {
  // 465 speaks TLS from the first byte, 587 is plaintext that must be upgraded
  // with STARTTLS. Any other port gets STARTTLS only if the server offers it.
  const secure = config.port === 465
  let transport: Transporter | undefined

  // One pooled transport for the lifetime of the process: connections are reused
  // and a broken one is dropped instead of being handed to every later send.
  const getTransport = (): Transporter => {
    transport ??= nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure,
      requireTLS: config.port === 587,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      proxy: config.proxy || undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      socketTimeout: config.timeoutMs,
    })
    return transport
  }

  const deliver = async (
    to: string,
    mail: OutgoingMail,
    purpose: Purpose,
    hint: string,
  ): Promise<void> => {
    const message: SendMailOptions = { from: config.from, to, ...mail }
    try {
      const info = await withDeadline(getTransport().sendMail(message), config.timeoutMs, purpose)
      console.log(
        `[mailer:smtp] ${purpose} sent  to=${maskEmail(to)}  ${hint}  id=${info.messageId}`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      // Rethrow on purpose: the route decides what the user is told, and the
      // "try again later" path only works if the failure is visible here.
      console.error(`[mailer:smtp] ${purpose} failed  to=${maskEmail(to)}  ${reason}`)
      throw error
    }
  }

  return {
    async sendVerificationCode(to, code): Promise<void> {
      await deliver(to, buildVerificationMail(code), 'verify', `code=${maskSecret(code)}`)
    },
    async sendPasswordReset(to, token): Promise<void> {
      await deliver(
        to,
        buildPasswordResetMail(appOrigin, token),
        'reset',
        `token=${maskSecret(token)}`,
      )
    },
  }
}
