import { describe, expect, it, vi } from 'vitest'

import { sendMail } from './transport'

describe('sendMail (STORY-16, D-089)', () => {
  it('skips sending and logs when GMAIL_USER or GMAIL_APP_PASSWORD is unset', async () => {
    const createTransport = vi.fn()
    const cases = [
      {},
      { GMAIL_USER: 'team@example.com' },
      { GMAIL_APP_PASSWORD: 'app-password' },
      { GMAIL_USER: '   ', GMAIL_APP_PASSWORD: 'app-password' },
    ]

    for (const env of cases) {
      const log = vi.fn()
      const result = await sendMail(
        { to: 'seeker@gmail.com', subject: 'Hello', text: 'Body' },
        { env, createTransport: createTransport as never, log },
      )
      expect(result).toEqual({ sent: false, reason: 'not_configured' })
      expect(log).toHaveBeenCalledWith(
        'Skipped email: GMAIL_USER or GMAIL_APP_PASSWORD is not set',
        expect.any(Object),
      )
    }

    expect(createTransport).not.toHaveBeenCalled()
  })

  it('sends plain-text mail via Gmail SMTP on port 465 when configured', async () => {
    const sendMailSpy = vi.fn(async () => ({ messageId: 'msg_1' }))
    const createTransport = vi.fn(() => ({ sendMail: sendMailSpy }))
    const log = vi.fn()

    const result = await sendMail(
      {
        to: 'seeker@gmail.com',
        subject: 'Your hold at Kapihan Study Hall is confirmed',
        text: 'Hold details',
      },
      {
        env: {
          GMAIL_USER: 'worq.team@gmail.com',
          GMAIL_APP_PASSWORD: 'secret-app-password',
        },
        createTransport: createTransport as never,
        log,
      },
    )

    expect(result).toEqual({ sent: true })
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'worq.team@gmail.com', pass: 'secret-app-password' },
    })
    expect(sendMailSpy).toHaveBeenCalledWith({
      from: 'Worq <worq.team@gmail.com>',
      to: 'seeker@gmail.com',
      subject: 'Your hold at Kapihan Study Hall is confirmed',
      text: 'Hold details',
    })
    expect(log).not.toHaveBeenCalled()
  })
})
