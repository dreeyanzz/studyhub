import { createHmac, randomBytes } from 'node:crypto'
import http from 'node:http'

/**
 * A stub of the four Stripe calls Worq makes (D-070, D-088), so the journeys can pay and
 * refund without Stripe: `playwright.config.ts` points the app's `STRIPE_API_URL` here.
 *
 * - `POST /v1/checkout/sessions` answers with a session whose `url` is this stub's own
 *   checkout page.
 * - `GET /pay/<session>` is that page: "Pay" goes to the session's success URL and
 *   "Cancel" to its cancel URL, as Stripe's hosted page would. Paying sends no webhook;
 *   the test sends it with `signedCheckoutCompleted`, when it chooses.
 * - `POST /v1/checkout/sessions/<session>/expire` answers that the session expired.
 * - `POST /v1/refunds` answers with a succeeded refund, and the same one again for the
 *   same Idempotency-Key, as Stripe would (STORY-14 design §2 and §4, TSK-14.5).
 *
 * Placeholders, not keys (D-005): the stub accepts any secret key, and the webhook secret
 * only has to match between the app and this file.
 */
export const STRIPE_STUB_PORT = 3199
export const STRIPE_STUB_URL = `http://127.0.0.1:${STRIPE_STUB_PORT}`
export const STRIPE_STUB_WEBHOOK_SECRET = 'whsec_e2e-stub-placeholder'

export interface StubSession {
  id: string
  reservationId: string
  successUrl: string
  cancelUrl: string
}

export interface StubRefund {
  id: string
  paymentIntent: string
  /** `metadata[payment_id]`: Worq's `payments.id`. */
  paymentId: string
  idempotencyKey: string
}

export interface StripeStub {
  /** Every checkout session the app made, oldest first. */
  sessions: StubSession[]
  /** Every refund the app asked for, one per Idempotency-Key, oldest first. */
  refunds: StubRefund[]
  close: () => Promise<void>
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function startStripeStub(): Promise<StripeStub> {
  const sessions: StubSession[] = []
  const refunds: StubRefund[] = []
  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', STRIPE_STUB_URL)
      const send = (status: number, type: string, body: string) => {
        res.writeHead(status, { 'Content-Type': type })
        res.end(body)
      }

      if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
        const form = new URLSearchParams(await readBody(req))
        const session: StubSession = {
          id: `cs_test_e2e_${randomBytes(8).toString('hex')}`,
          reservationId: form.get('client_reference_id') ?? '',
          successUrl: form.get('success_url') ?? '',
          cancelUrl: form.get('cancel_url') ?? '',
        }
        sessions.push(session)
        send(
          200,
          'application/json',
          JSON.stringify({
            id: session.id,
            object: 'checkout.session',
            url: `${STRIPE_STUB_URL}/pay/${session.id}`,
          }),
        )
        return
      }

      const expire = /^\/v1\/checkout\/sessions\/([^/]+)\/expire$/.exec(url.pathname)
      if (req.method === 'POST' && expire) {
        send(
          200,
          'application/json',
          JSON.stringify({
            id: expire[1],
            object: 'checkout.session',
            status: 'expired',
          }),
        )
        return
      }

      if (req.method === 'POST' && url.pathname === '/v1/refunds') {
        const form = new URLSearchParams(await readBody(req))
        const header = req.headers['idempotency-key']
        const idempotencyKey = (Array.isArray(header) ? header[0] : header) ?? ''
        let refund = refunds.find(
          (r) => idempotencyKey !== '' && r.idempotencyKey === idempotencyKey,
        )
        if (!refund) {
          refund = {
            id: `re_test_e2e_${randomBytes(8).toString('hex')}`,
            paymentIntent: form.get('payment_intent') ?? '',
            paymentId: form.get('metadata[payment_id]') ?? '',
            idempotencyKey,
          }
          refunds.push(refund)
        }
        send(
          200,
          'application/json',
          JSON.stringify({
            id: refund.id,
            object: 'refund',
            status: 'succeeded',
            payment_intent: refund.paymentIntent,
          }),
        )
        return
      }

      const pay = /^\/pay\/([^/]+)$/.exec(url.pathname)
      const session = pay ? sessions.find((s) => s.id === pay[1]) : undefined
      if (req.method === 'GET' && session) {
        send(
          200,
          'text/html; charset=utf-8',
          `<!doctype html><html lang="en"><title>Stub checkout</title><main><h1>Stub checkout</h1>` +
            `<a href="${escapeHtml(session.successUrl)}">Pay</a> ` +
            `<a href="${escapeHtml(session.cancelUrl)}">Cancel</a></main></html>`,
        )
        return
      }

      send(
        404,
        'application/json',
        JSON.stringify({
          error: { message: `stub: no route for ${req.method} ${url.pathname}` },
        }),
      )
    })()
  })

  return new Promise((resolve) =>
    server.listen(STRIPE_STUB_PORT, '127.0.0.1', () =>
      resolve({
        sessions,
        refunds,
        close: () => new Promise((done) => server.close(() => done())),
      }),
    ),
  )
}

/**
 * A `checkout.session.completed` event for a paid session, signed as Stripe signs one
 * (`t=<seconds>,v1=<HMAC-SHA256 of "<seconds>.<body>">`), like
 * `scripts/simulate-stripe-webhook.mjs`.
 */
export function signedCheckoutCompleted(reservationId: string, sessionId: string) {
  const now = Math.floor(Date.now() / 1000)
  const suffix = randomBytes(8).toString('hex')
  const body = JSON.stringify({
    id: `evt_test_e2e_${suffix}`,
    object: 'event',
    type: 'checkout.session.completed',
    livemode: false,
    created: now,
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        status: 'complete',
        payment_status: 'paid',
        payment_intent: `pi_test_e2e_${suffix}`,
        client_reference_id: reservationId,
        metadata: { reservation_id: reservationId },
        livemode: false,
      },
    },
  })
  const signature = createHmac('sha256', STRIPE_STUB_WEBHOOK_SECRET)
    .update(`${now}.${body}`, 'utf8')
    .digest('hex')
  return { body, signature: `t=${now},v1=${signature}` }
}
