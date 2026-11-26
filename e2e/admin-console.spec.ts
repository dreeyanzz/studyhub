import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'

import { startStripeStub, STRIPE_STUB_URL, type StripeStub } from './support/stripe-stub'

/**
 * The administration console (STORY-14 design §4, TSK-14.5, FR-5.2, FR-5.3, D-080,
 * D-088): an Administrator removes a reported review and the profile's average changes,
 * refunds the fee of a hold the Host overrode, and Seekers and Hosts can't open either
 * page. The spec makes its own Space, visits, reviews, report and paid hold as postgres,
 * as e2e/seeker-journey.spec.ts does, and removes them after. Refunds go to the Stripe
 * stub (./support/stripe-stub.ts), never to Stripe (D-005, D-070). Local stack and CI
 * only (D-013, D-028).
 */

// The shared seed password for all local test accounts (supabase/seed.sql).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded accounts (supabase/seed.sql). host@ owns every Space this file makes.
const HOST_ID = 'b0000000-0000-4000-8000-000000000001'
const SEEKER_1 = 'c0000000-0000-4000-8000-000000000001' // seeker@, Sam Dela Cruz
const SEEKER_2 = 'c0000000-0000-4000-8000-000000000002' // seeker2@, Rina Bautista
const NAME_PREFIX = 'Admin Console'

function db() {
  return postgres(databaseUrl, { max: 1 })
}

interface Fixture {
  id: string
  name: string
  units: Record<'A1' | 'A2', string>
}

/** A Verified Space, open all day, with one zone and two seats, made as postgres. */
async function makeSpace(name: string): Promise<Fixture> {
  const sql = db()
  try {
    const [space] = await sql<{ id: string }[]>`
      insert into public.spaces
        (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
      values
        (${HOST_ID}, ${name}, '8 Console Road, Cebu City', '00:00', '00:00', 'verified',
         interval '1 hour', 10.354, 123.9114, 'budget')
      returning id`
    if (!space) throw new Error('no space')
    const [zone] = await sql<{ id: string }[]>`
      insert into public.zones (space_id, name, position) values (${space.id}, 'Desks', 0) returning id`
    if (!zone) throw new Error('no zone')
    const units = await sql<{ id: string; label: 'A1' | 'A2' }[]>`
      insert into public.units (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span, host_state)
      values (${space.id}, ${zone.id}, 'seat', 'A1', 0, 0, 1, 'available'),
             (${space.id}, ${zone.id}, 'seat', 'A2', 0, 1, 1, 'available')
      returning id, label`
    const byLabel = Object.fromEntries(
      units.map((u) => [u.label, u.id]),
    ) as Fixture['units']
    return { id: space.id, name, units: byLabel }
  } finally {
    await sql.end()
  }
}

/**
 * A Seeker's finished visit to a unit two days ago, paid, with the review it allows:
 * all four ratings set to `rating`. Returns the review's id.
 */
async function reviewedVisit(
  space: Fixture,
  unit: 'A1' | 'A2',
  seekerId: string,
  rating: number,
  comment: string,
) {
  const sql = db()
  try {
    const [visit] = await sql<{ id: string }[]>`
      insert into public.reservations (
        seeker_id, space_id, unit_id, unit_label, status, wait_window,
        payment_window_ends_at, wait_window_ends_at, booking_token,
        checked_in_at, checked_out_at, ended_at, created_at
      )
      values (
        ${seekerId}, ${space.id}, ${space.units[unit]}, ${unit}, 'completed', interval '60 minutes',
        now() - interval '2 days 2 hours 50 minutes', now() - interval '2 days 1 hour 55 minutes',
        private.new_booking_token(), now() - interval '2 days 2 hours', now() - interval '2 days',
        now() - interval '2 days', now() - interval '2 days 3 hours'
      )
      returning id`
    if (!visit) throw new Error('no visit')
    await sql`
      insert into public.payments
        (reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at)
      values
        (${visit.id}, 'paid', 5000, ${'cs_test_adm_' + visit.id.slice(0, 8)},
         ${'pi_test_adm_' + visit.id.slice(0, 8)}, now() - interval '2 days 2 hours 55 minutes')`
    const [review] = await sql<{ id: string }[]>`
      insert into public.reviews
        (reservation_id, space_id, author_id, quietness, wifi_reliability, cleanliness, comfort, comment)
      values
        (${visit.id}, ${space.id}, ${seekerId}, ${rating}, ${rating}, ${rating}, ${rating}, ${comment})
      returning id`
    if (!review) throw new Error('no review')
    return review.id
  } finally {
    await sql.end()
  }
}

async function report(reviewId: string, reporterId: string) {
  const sql = db()
  try {
    await sql`
      insert into public.review_reports (review_id, reporter_id, reason, note)
      values (${reviewId}, ${reporterId}, 'offensive', 'Insults the staff by name.')`
  } finally {
    await sql.end()
  }
}

/** Holds a unit as a Seeker through hold_unit, and confirms its payment as the webhook would. */
async function paidHold(seekerId: string, unitId: string) {
  const sql = db()
  try {
    let id = ''
    await sql.begin(async (tx) => {
      await tx.unsafe('set local role authenticated')
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: seekerId, role: 'authenticated' })}, true)`
      const [held] = await tx<
        { reservation_id: string }[]
      >`select * from public.hold_unit(${unitId}, 30)`
      if (!held) throw new Error('no hold')
      id = held.reservation_id
      const session = 'cs_test_e2e_adm_' + id.slice(0, 8)
      await tx`select public.attach_checkout_session(${id}, ${session}, ${STRIPE_STUB_URL + '/pay/none'})`
      await tx.unsafe('reset role')
      await tx`select public.confirm_payment(${id}, ${session}, ${'pi_test_e2e_adm_' + id.slice(0, 8)})`
    })
    return id
  } finally {
    await sql.end()
  }
}

/**
 * The Host marks the held unit Available, which ends the Reserved hold and keeps its fee
 * paid (R9). Like the occupancy page, it names the hold it saw, by id and status (N21).
 */
async function hostOverride(unitId: string, reservationId: string) {
  const sql = db()
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe('set local role authenticated')
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: HOST_ID, role: 'authenticated' })}, true)`
      await tx`select public.set_unit_state(${unitId}, 'available', ${reservationId}, 'reserved')`
    })
  } finally {
    await sql.end()
  }
}

async function payment(reservationId: string) {
  const sql = db()
  try {
    const [row] = await sql<
      {
        id: string
        status: string
        refund_id: string | null
        reservation_status: string
      }[]
    >`
      select p.id, p.status, p.refund_id, r.status as reservation_status
      from public.payments p join public.reservations r on r.id = p.reservation_id
      where r.id = ${reservationId}`
    if (!row) throw new Error(`No payment for ${reservationId}`)
    return row
  } finally {
    await sql.end()
  }
}

/**
 * Removes this file's Spaces (their visits, reviews and reports go with them), and the
 * seeded Seekers' active holds: a Seeker may hold one unit at a time, so another file's
 * hold would refuse this file's.
 */
async function cleanup() {
  const sql = db()
  try {
    await sql`
      delete from public.reservations
      where seeker_id in (${SEEKER_1}, ${SEEKER_2})
        and status in ('pending_payment', 'reserved', 'occupied')`
    await sql`
      delete from public.reservations
      where space_id in (select id from public.spaces where name like ${NAME_PREFIX + ' %'})`
    await sql`delete from public.spaces where host_id = ${HOST_ID} and name like ${NAME_PREFIX + ' %'}`
  } finally {
    await sql.end()
  }
}

async function signIn(page: Page, email: string, returnUrl: string) {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(returnUrl)
}

async function newPage(browser: Browser, email?: string, returnUrl = '/') {
  const page = await (await browser.newContext()).newPage()
  if (email) await signIn(page, email, returnUrl)
  return page
}

function uniqueName(label: string) {
  return `${NAME_PREFIX} ${label} ${Date.now()}`
}

let stub: StripeStub

test.describe('Administration console (STORY-14)', () => {
  test.beforeAll(async () => {
    stub = await startStripeStub()
  })
  test.afterAll(async () => {
    await cleanup()
    await stub.close()
  })
  test.beforeEach(cleanup)

  test('RV5: an Administrator removes a reported review, and the profile’s average changes', async ({
    browser,
  }) => {
    const space = await makeSpace(uniqueName('Moderation'))
    await reviewedVisit(
      space,
      'A1',
      SEEKER_1,
      5,
      'Calm desks and fast Wi-Fi all afternoon.',
    )
    const reported = await reviewedVisit(
      space,
      'A2',
      SEEKER_2,
      1,
      'The staff here are the worst people I have met.',
    )
    await report(reported, SEEKER_1)

    // Before: both reviews count, (5 + 1) / 2.
    const visitor = await newPage(browser)
    await visitor.goto(`/spaces/${space.id}`)
    const reviews = visitor.getByTestId('space-reviews-section')
    await expect(reviews.getByTestId('reviews-overall-rating')).toContainText(
      '3.0 · 2 reviews',
    )
    await expect(reviews.getByTestId('space-reviews-list')).toContainText(
      'The staff here are the worst people I have met.',
    )

    // The Administrator finds it in Reported, with its open report, and removes it.
    const admin = await newPage(browser, 'admin@example.test', '/admin/moderation')
    const card = admin.getByTestId(`moderation-review-${reported}`)
    await expect(card).toContainText(space.name)
    await expect(card).toContainText('Rina Bautista')
    await expect(admin.getByTestId(`open-report-count-${reported}`)).toHaveText(
      '1 open report',
    )
    await expect(card).toContainText('Insults the staff by name.')

    await admin.getByTestId(`moderation-remove-${reported}`).click()
    const confirm = admin.getByRole('alertdialog')
    await expect(confirm.getByText('Remove review?')).toBeVisible()
    await confirm.getByRole('button', { name: 'Remove permanently' }).click()
    await expect(admin.getByTestId('moderation-live-status')).toHaveText(
      'Review removed.',
    )
    await expect(card).toHaveCount(0)

    // It sits read-only in Removed.
    await admin.goto('/admin/moderation?list=removed')
    const removed = admin.getByTestId(`moderation-review-${reported}`)
    await expect(removed).toContainText(space.name)
    await expect(removed.getByRole('button')).toHaveCount(0)

    // After: only the five-star review counts, and the removed one is gone from the list.
    await visitor.reload()
    await expect(reviews.getByTestId('reviews-overall-rating')).toContainText(
      '5.0 · 1 review',
    )
    await expect(reviews.getByTestId('space-reviews-list')).not.toContainText(
      'The staff here are the worst people I have met.',
    )
  })

  test('P1: an Administrator refunds the fee of a hold the Host overrode, and the Seeker’s hold page says it was refunded', async ({
    browser,
  }) => {
    const space = await makeSpace(uniqueName('Refund'))
    const hold = await paidHold(SEEKER_1, space.units.A1)
    await hostOverride(space.units.A1, hold)
    const before = await payment(hold)
    expect(before).toMatchObject({ status: 'paid', reservation_status: 'cancelled' })

    // The Seeker is told an Administrator can refund it.
    const seeker = await newPage(browser, 'seeker@example.test', '/seeker')
    await seeker.goto(`/seeker/reservations/${hold}`)
    await expect(
      seeker.getByText(
        'Your ₱50.00 payment was recorded, and an Administrator can refund it.',
      ),
    ).toBeVisible()

    // The Administrator refunds it from the Refundable list.
    const admin = await newPage(browser, 'admin@example.test', '/admin/payments')
    await admin.goto('/admin/payments?status=refundable')
    const record = admin.getByTestId(`payment-record-${before.id}`)
    await expect(record).toContainText(space.name)
    await expect(record).toContainText('Sam Dela Cruz')
    await expect(admin.getByTestId(`payment-status-${before.id}`)).toHaveText('Paid')

    await admin.getByTestId(`payment-refund-trigger-${before.id}`).click()
    const dialog = admin.getByRole('dialog', { name: 'Refund reservation fee' })
    await expect(dialog).toContainText('Full refund: ₱50.00')
    await dialog.getByLabel('Reason').fill('The Host closed the unit before the visit.')
    await dialog.getByRole('button', { name: 'Confirm refund' }).click()
    await expect(admin.getByTestId('payments-live-status')).toHaveText('Refund recorded.')
    await expect(dialog).toBeHidden()

    // Stripe (the stub) was asked once, for the whole fee of that payment intent.
    expect(stub.refunds).toHaveLength(1)
    const [refund] = stub.refunds
    expect(refund).toMatchObject({
      paymentIntent: `pi_test_e2e_adm_${hold.slice(0, 8)}`,
      paymentId: before.id,
      idempotencyKey: `refund-${before.id}`,
    })
    expect(await payment(hold)).toMatchObject({
      status: 'refunded',
      refund_id: refund?.id,
    })

    await admin.goto('/admin/payments?status=refunded')
    await expect(admin.getByTestId(`payment-status-${before.id}`)).toHaveText('Refunded')
    await expect(admin.getByTestId(`payment-refund-details-${before.id}`)).toContainText(
      'The Host closed the unit before the visit.',
    )
    await expect(admin.getByTestId(`payment-refund-trigger-${before.id}`)).toHaveCount(0)

    // The Seeker's hold page now says it was refunded.
    await seeker.reload()
    await expect(seeker.getByText('Your ₱50.00 payment was refunded.')).toBeVisible()
  })

  for (const { email, portal } of [
    { email: 'seeker@example.test', portal: '/seeker' },
    { email: 'host@example.test', portal: '/host' },
  ]) {
    test(`a ${portal.slice(1)} who opens /admin/moderation or /admin/payments goes to their own portal (D-032)`, async ({
      page,
    }) => {
      await signIn(page, email, portal)
      for (const path of ['/admin/moderation', '/admin/payments']) {
        await page.goto(path)
        await expect(page).toHaveURL(portal)
      }
    })
  }
})
