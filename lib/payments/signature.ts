// Verifies the Stripe-Signature header on a webhook delivery (sandbox payment
// confirmation flow §3.1, D-010, D-070). Pure apart from node:crypto: no network,
// no database, no clock of its own (the caller passes the time).
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Stripe's libraries use 5 minutes too (flow §6). */
export const SIGNATURE_TOLERANCE_SECONDS = 300

export type SignatureCheck =
  | { ok: true }
  /** No header, no `t`, or no `v1`: answered like a bad signature (W3). */
  | { ok: false; reason: 'malformed' }
  /** Signed more than the tolerance away from now: a replay (W4). */
  | { ok: false; reason: 'stale' }
  /** No `v1` matches the body and the secret (W3). */
  | { ok: false; reason: 'mismatch' }

/** The lowercase hex HMAC-SHA256 of `${timestamp}.${rawBody}`, as Stripe signs it. */
export function computeSignature(
  timestamp: number,
  rawBody: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex')
}

/**
 * Keeps the timestamp `t` and every `v1`. Everything else is ignored, whatever its
 * order: the sandbox's `v0`, Stripe's unsigned debugging entries (`secret`,
 * `destination`, `payload`) and any entry Stripe adds later.
 */
export function parseSignatureHeader(header: string): {
  timestamp: number | null
  v1: string[]
} {
  let timestamp: number | null = null
  const v1: string[] = []
  for (const entry of header.split(',')) {
    const at = entry.indexOf('=')
    if (at < 0) continue
    const key = entry.slice(0, at).trim()
    const value = entry.slice(at + 1).trim()
    if (key === 't' && /^\d+$/.test(value)) timestamp = Number(value)
    if (key === 'v1' && value) v1.push(value)
  }
  return { timestamp, v1 }
}

export function verifySignature(input: {
  header: string | null
  rawBody: string
  secret: string
  nowSeconds: number
  toleranceSeconds?: number
}): SignatureCheck {
  if (!input.header) return { ok: false, reason: 'malformed' }
  const { timestamp, v1 } = parseSignatureHeader(input.header)
  if (timestamp === null || v1.length === 0) return { ok: false, reason: 'malformed' }

  const tolerance = input.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS
  if (Math.abs(input.nowSeconds - timestamp) > tolerance)
    return { ok: false, reason: 'stale' }

  const expected = Buffer.from(
    computeSignature(timestamp, input.rawBody, input.secret),
    'utf8',
  )
  // One match is enough: while a secret is being rolled, Stripe signs once per secret.
  const matches = v1.some((candidate) => {
    const given = Buffer.from(candidate, 'utf8')
    // timingSafeEqual throws on different lengths, so check that first.
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
  return matches ? { ok: true } : { ok: false, reason: 'mismatch' }
}
