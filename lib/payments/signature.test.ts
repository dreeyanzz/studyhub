import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { computeSignature, parseSignatureHeader, verifySignature } from './signature'

const secret = 'whsec_test_secret'
const otherSecret = 'whsec_rolled_secret'
const rawBody = '{"id":"evt_test_1","type":"checkout.session.completed"}'
const t = 1_794_629_220

function hmac(key: string, body = rawBody, timestamp = t) {
  return createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')
}

function verify(
  header: string | null,
  overrides: { nowSeconds?: number; body?: string } = {},
) {
  return verifySignature({
    header,
    rawBody: overrides.body ?? rawBody,
    secret,
    nowSeconds: overrides.nowSeconds ?? t + 10,
  })
}

describe('computeSignature', () => {
  it('is the hex HMAC-SHA256 of "timestamp.body", as Stripe signs it', () => {
    expect(computeSignature(t, rawBody, secret)).toBe(hmac(secret))
  })
})

describe('parseSignatureHeader', () => {
  it('keeps t and every v1, and drops v0 and debugging entries in any order', () => {
    const header = `v0=abc,secret=whsec_****Vt,v1=one,t=${t},destination=we_1,v1=two,payload=a25aef`
    expect(parseSignatureHeader(header)).toEqual({ timestamp: t, v1: ['one', 'two'] })
  })

  it('reads no timestamp from a non-numeric t', () => {
    expect(parseSignatureHeader('t=soon,v1=abc').timestamp).toBeNull()
  })
})

describe('verifySignature (flow §3.1, W3, W4)', () => {
  it('accepts a valid v1', () => {
    expect(verify(`t=${t},v1=${hmac(secret)}`)).toEqual({ ok: true })
  })

  it('accepts a sandbox header with a v0 and unsigned debugging entries', () => {
    const header = `t=${t},v1=${hmac(secret)},v0=${hmac('fake')},secret=whsec_****cret,payload=1234`
    expect(verify(header)).toEqual({ ok: true })
  })

  it('accepts a second v1 that matches, as while a secret is being rolled', () => {
    const header = `t=${t},v1=${hmac(otherSecret)},v1=${hmac(secret)}`
    expect(verify(header)).toEqual({ ok: true })
  })

  it('refuses a missing header, or one with no t or no v1, as malformed', () => {
    expect(verify(null)).toEqual({ ok: false, reason: 'malformed' })
    expect(verify('')).toEqual({ ok: false, reason: 'malformed' })
    expect(verify(`v1=${hmac(secret)}`)).toEqual({ ok: false, reason: 'malformed' })
    expect(verify(`t=${t},v0=${hmac(secret)}`)).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('refuses a wrong v1 as a mismatch', () => {
    expect(verify(`t=${t},v1=${hmac(otherSecret)}`)).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })

  it('refuses a v1 for a changed body', () => {
    expect(verify(`t=${t},v1=${hmac(secret)}`, { body: `${rawBody} ` })).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })

  it('refuses a v1 of the wrong length without throwing', () => {
    expect(() => verify(`t=${t},v1=abc`)).not.toThrow()
    expect(verify(`t=${t},v1=abc`)).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('never counts a v0 as a signature, even a correct one', () => {
    expect(verify(`t=${t},v0=${hmac(secret)},v1=wrong`)).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })

  it('refuses a timestamp more than 300 seconds off, either way, as stale', () => {
    const header = `t=${t},v1=${hmac(secret)}`
    expect(verify(header, { nowSeconds: t + 301 })).toEqual({
      ok: false,
      reason: 'stale',
    })
    expect(verify(header, { nowSeconds: t - 301 })).toEqual({
      ok: false,
      reason: 'stale',
    })
    expect(verify(header, { nowSeconds: t + 300 })).toEqual({ ok: true })
  })
})
