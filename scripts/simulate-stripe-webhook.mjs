// Sends a signed checkout.session.completed event for one reservation to the local
// webhook route, the way Stripe would (STORY-09 design §4 and "Stripe settings",
// sandbox payment confirmation flow §3.1). It is for the timed manual checks, such
// as a payment after the payment window or one racing a cancel, and for anyone
// without Stripe CLI access to the sandbox. Real payments go through
// `npm run stripe:listen` instead.
//
// Signs with STRIPE_WEBHOOK_SECRET from the same env files the dev server reads
// (.env.development.local wins over .env.local), so the route accepts it:
//   npm run webhook:simulate -- <reservation-id>
//   npm run webhook:simulate -- <reservation-id> --url http://localhost:3005/api/webhooks/stripe
//   npm run webhook:simulate -- <reservation-id> --session cs_test_...   (the hold's own checkout)
// Each run invents a new PaymentIntent id, so a repeat is a second payment, not a
// redelivery. Never prints the secret.
import { createHmac, randomBytes } from 'node:crypto'

function fail(message) {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)
let reservationId
let url = 'http://localhost:3000/api/webhooks/stripe'
let sessionId
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') url = args[++i]
  else if (args[i] === '--session') sessionId = args[++i]
  else if (!reservationId) reservationId = args[i]
  else fail(`Unexpected argument: ${args[i]}`)
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!reservationId || !uuid.test(reservationId)) {
  fail(
    'Usage: npm run webhook:simulate -- <reservation-id> [--url <route>] [--session <cs_...>]',
  )
}
if (sessionId !== undefined && !/^cs_\w+$/.test(sessionId))
  fail('--session must be a cs_ id')
if (!url) fail('--url needs a value')

const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
if (!secret)
  fail('STRIPE_WEBHOOK_SECRET is not set in .env.local or .env.development.local.')

const suffix = randomBytes(8).toString('hex')
const now = Math.floor(Date.now() / 1000)
const body = JSON.stringify({
  id: `evt_test_sim_${suffix}`,
  object: 'event',
  type: 'checkout.session.completed',
  livemode: false,
  created: now,
  data: {
    object: {
      id: sessionId ?? `cs_test_sim_${suffix}`,
      object: 'checkout.session',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: `pi_test_sim_${suffix}`,
      client_reference_id: reservationId,
      metadata: { reservation_id: reservationId },
      livemode: false,
    },
  },
})
const signature = createHmac('sha256', secret)
  .update(`${now}.${body}`, 'utf8')
  .digest('hex')

let response
try {
  response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': `t=${now},v1=${signature}`,
    },
    body,
  })
} catch (error) {
  fail(`Could not reach ${url}: ${error.message}. Is the dev server running?`)
}
const text = await response.text()
console.log(`${response.status} ${text}`)
process.exit(response.ok ? 0 : 1)
