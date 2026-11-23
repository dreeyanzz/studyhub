// Builds and sends the Seeker's hold confirmation email after a confirmed sandbox
// payment (STORY-16 design §2, D-089). Takes plain values only: no database, no
// session, and never receives or includes the booking token.
import 'server-only'

import { formatManilaTime } from '@/lib/reservations/format'

import { sendMail, type EmailLog, type MailSender } from './transport'

export interface HoldConfirmationInput {
  reservationId: string
  spaceName: string
  unitLabel: string
  waitWindowEndsAt: string | Date | null
  origin: string
  recipientEmail: string | null | undefined
}

export type HoldConfirmationResult =
  | { sent: true }
  | {
      sent: false
      reason: 'missing_email' | 'synthetic_address' | 'not_configured' | 'transport_error'
    }

export interface HoldConfirmationDependencies {
  sendMail?: MailSender
  log?: EmailLog
}

function defaultLog(message: string, details?: Record<string, unknown>) {
  console.warn(`[email] ${message}`, details ?? {})
}

/**
 * Formats the plain-text subject and body for one confirmed hold (D-089).
 * Plain text prevents a Host-authored Space name from injecting HTML markup.
 */
export function buildHoldConfirmationEmail(
  input: Omit<HoldConfirmationInput, 'recipientEmail'>,
): { subject: string; text: string } {
  const baseOrigin = input.origin.replace(/\/+$/, '')
  const holdUrl = `${baseOrigin}/seeker/reservations/${input.reservationId}`
  const deadlineText = input.waitWindowEndsAt
    ? `${formatManilaTime(input.waitWindowEndsAt)} (Asia/Manila)`
    : 'when your wait window ends'

  return {
    subject: `Your hold at ${input.spaceName} is confirmed`,
    text: [
      `Your hold at ${input.spaceName} is confirmed.`,
      '',
      `Space: ${input.spaceName}`,
      `Unit: ${input.unitLabel}`,
      `Check in by: ${deadlineText}`,
      '',
      `Open your hold page for your QR code and directions: ${holdUrl}`,
    ].join('\n'),
  }
}

/**
 * Decides whether to send the confirmation email and invokes the mail sender once.
 * Skips missing addresses and `@example.test` addresses (D-013), and logs any
 * transport error without retrying or throwing.
 */
export async function sendHoldConfirmationEmail(
  input: HoldConfirmationInput,
  deps: HoldConfirmationDependencies = {},
): Promise<HoldConfirmationResult> {
  const log = deps.log ?? defaultLog
  const recipient = input.recipientEmail?.trim()

  if (!recipient) {
    log('Skipped hold confirmation email: missing recipient address', {
      reservationId: input.reservationId,
    })
    return { sent: false, reason: 'missing_email' }
  }

  if (recipient.toLowerCase().endsWith('@example.test')) {
    log('Skipped hold confirmation email: synthetic @example.test address', {
      reservationId: input.reservationId,
    })
    return { sent: false, reason: 'synthetic_address' }
  }

  const { subject, text } = buildHoldConfirmationEmail(input)
  const deliver = deps.sendMail ?? ((message) => sendMail(message, { log }))

  try {
    const result = await deliver({ to: recipient, subject, text })
    if (!result.sent) {
      return { sent: false, reason: result.reason }
    }
    return { sent: true }
  } catch (error) {
    log('Failed to send hold confirmation email', {
      reservationId: input.reservationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { sent: false, reason: 'transport_error' }
  }
}
