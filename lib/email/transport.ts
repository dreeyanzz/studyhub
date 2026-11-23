// Plain-text SMTP mail sender over Gmail with an app password (STORY-16 design §2,
// D-089). Server only: reads GMAIL_USER and GMAIL_APP_PASSWORD, which never leave
// the server and are omitted in local tests and CI.
import 'server-only'

import nodemailer from 'nodemailer'

export interface MailMessage {
  to: string
  subject: string
  text: string
}

export type SendMailResult = { sent: true } | { sent: false; reason: 'not_configured' }

export type EmailLog = (message: string, details?: Record<string, unknown>) => void

export type MailSender = (message: MailMessage) => Promise<SendMailResult>

type Env = Record<string, string | undefined>

export interface TransportDependencies {
  env?: Env
  createTransport?: typeof nodemailer.createTransport
  log?: EmailLog
}

function defaultLog(message: string, details?: Record<string, unknown>) {
  console.warn(`[email] ${message}`, details ?? {})
}

/**
 * Sends one plain-text email through Gmail's SMTP server on port 465 with TLS
 * (D-089). When `GMAIL_USER` or `GMAIL_APP_PASSWORD` is unset, it logs why and
 * returns without opening a socket.
 */
export async function sendMail(
  message: MailMessage,
  deps: TransportDependencies = {},
): Promise<SendMailResult> {
  const env = deps.env ?? process.env
  const log = deps.log ?? defaultLog
  const user = env.GMAIL_USER?.trim()
  const pass = env.GMAIL_APP_PASSWORD?.trim()

  if (!user || !pass) {
    log('Skipped email: GMAIL_USER or GMAIL_APP_PASSWORD is not set', {
      hasUser: Boolean(user),
      hasAppPassword: Boolean(pass),
    })
    return { sent: false, reason: 'not_configured' }
  }

  const createTransport = deps.createTransport ?? nodemailer.createTransport
  const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: `Worq <${user}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
  })

  return { sent: true }
}
