import { describe, expect, it, vi } from 'vitest'

import {
  buildHoldConfirmationEmail,
  sendHoldConfirmationEmail,
  type HoldConfirmationInput,
} from './hold-confirmation'

const baseInput: HoldConfirmationInput = {
  reservationId: '10000000-0000-4000-8000-000000000001',
  spaceName: 'Kapihan Study Hall',
  unitLabel: 'Desk A1',
  // 2026-11-18T07:42:00Z is 3:42 PM in Asia/Manila (UTC+8).
  waitWindowEndsAt: '2026-11-18T07:42:00.000Z',
  origin: 'https://worqph.vercel.app/',
  recipientEmail: 'seeker.real@gmail.com',
}

describe('buildHoldConfirmationEmail (STORY-16, D-089)', () => {
  it('builds the subject and plain-text body with Space, unit, Manila time and hold link', () => {
    const email = buildHoldConfirmationEmail(baseInput)

    expect(email.subject).toBe('Your hold at Kapihan Study Hall is confirmed')
    expect(email.text).toContain('Kapihan Study Hall')
    expect(email.text).toContain('Desk A1')
    expect(email.text).toContain('3:42 PM (Asia/Manila)')
    expect(email.text).toContain(
      'https://worqph.vercel.app/seeker/reservations/10000000-0000-4000-8000-000000000001',
    )
    expect(email.text).not.toContain('booking_token')
  })
})

describe('sendHoldConfirmationEmail (STORY-16, D-089)', () => {
  it('skips and logs @example.test addresses without calling sendMail (D-013)', async () => {
    for (const recipientEmail of ['seeker@example.test', 'HOST@EXAMPLE.TEST']) {
      const sendMail = vi.fn()
      const log = vi.fn()

      const result = await sendHoldConfirmationEmail(
        { ...baseInput, recipientEmail },
        { sendMail, log },
      )

      expect(result).toEqual({ sent: false, reason: 'synthetic_address' })
      expect(sendMail).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(
        'Skipped hold confirmation email: synthetic @example.test address',
        { reservationId: baseInput.reservationId },
      )
    }
  })

  it('skips and logs missing or blank email addresses without calling sendMail', async () => {
    for (const recipientEmail of [null, undefined, '', '   ']) {
      const sendMail = vi.fn()
      const log = vi.fn()

      const result = await sendHoldConfirmationEmail(
        { ...baseInput, recipientEmail },
        { sendMail, log },
      )

      expect(result).toEqual({ sent: false, reason: 'missing_email' })
      expect(sendMail).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(
        'Skipped hold confirmation email: missing recipient address',
        { reservationId: baseInput.reservationId },
      )
    }
  })

  it('forwards not_configured when Gmail credentials are unset', async () => {
    const sendMail = vi.fn(async () => ({
      sent: false as const,
      reason: 'not_configured' as const,
    }))
    const log = vi.fn()

    const result = await sendHoldConfirmationEmail(baseInput, { sendMail, log })

    expect(result).toEqual({ sent: false, reason: 'not_configured' })
    expect(sendMail).toHaveBeenCalledTimes(1)
  })

  it('logs a transport error and never retries', async () => {
    const sendMail = vi.fn(async () => {
      throw new Error('SMTP connection timed out')
    })
    const log = vi.fn()

    const result = await sendHoldConfirmationEmail(baseInput, { sendMail, log })

    expect(result).toEqual({ sent: false, reason: 'transport_error' })
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('Failed to send hold confirmation email', {
      reservationId: baseInput.reservationId,
      error: 'SMTP connection timed out',
    })
  })
})
