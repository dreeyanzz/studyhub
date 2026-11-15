import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'

import {
  signedCheckoutCompleted,
  startStripeStub,
  STRIPE_STUB_URL,
  type StripeStub,
} from './support/stripe-stub'

/**
 * The Seeker journey (docs/flows/seeker-journey.md, #178), walked as its "Paths and test
 * coverage" table names it. Each test's title starts with the path IDs it proves.
 * Payments go to the Stripe stub in ./support/stripe-stub.ts (playwright.config.ts points
 * the app at it), and the webhook is signed the way Stripe signs one. Runs against the
 * local stack and CI only (D-013, D-028).
 */

// The shared seed password for all local test accounts (supabase/seed.sql).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded accounts (supabase/seed.sql). host@ owns every Space this file makes.
const HOST_ID = 'b0000000-0000-4000-8000-000000000001'
const SEEKER_1 = 'c0000000-0000-4000-8000-000000000001'
const SEEKER_2 = 'c0000000-0000-4000-8000-000000000002'
const NAME_PREFIX = 'Seeker Journey'
const SIGNUP_PREFIX = 'journey.seeker.'

function db() {
  return postgres(databaseUrl, { max: 1 })
}

interface Fixture {
  id: string
  name: string
  units: Record<'P1' | 'P2', string>
}

interface SpaceOptions {
  opens?: string
  closes?: string
  status?: 'verified' | 'pending'
  occupied?: boolean
  curated?: string[]
  custom?: string[]
}

/** A Space with one zone and two seats, P1 and P2, made through SQL as postgres. */
async function makeSpace(name: string, options: SpaceOptions = {}): Promise<Fixture> {
  const sql = db()
  try {
    const [space] = await sql<{ id: string }[]>`
      insert into public.spaces
        (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
      values
        (${HOST_ID}, ${name}, '7 Journey Ave, Cebu City', ${options.opens ?? '00:00'},
         ${options.closes ?? '00:00'}, ${options.status ?? 'verified'}, interval '1 hour',
         10.354, 123.9114, 'budget')
      returning id`
    if (!space) throw new Error('no space')
    const [zone] = await sql<{ id: string }[]>`
      insert into public.zones (space_id, name, position) values (${space.id}, 'Desks', 0) returning id`
    if (!zone) throw new Error('no zone')
    const state = options.occupied ? 'occupied' : 'available'
    const units = await sql<{ id: string; label: 'P1' | 'P2' }[]>`
      insert into public.units (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span, host_state)
      values (${space.id}, ${zone.id}, 'seat', 'P1', 0, 0, 1, ${state}),
             (${space.id}, ${zone.id}, 'seat', 'P2', 0, 1, 1, ${state})
      returning id, label`
    for (const label of options.curated ?? []) {
      await sql`
        insert into public.space_curated_tags (space_id, tag_id)
        select ${space.id}, id from public.curated_tags where label = ${label}`
    }
    for (const tag of options.custom ?? []) {
      await sql`insert into public.space_custom_tags (space_id, name) values (${space.id}, ${tag})`
    }
    const byLabel = Object.fromEntries(
      units.map((u) => [u.label, u.id]),
    ) as Fixture['units']
    return { id: space.id, name, units: byLabel }
  } finally {
    await sql.end()
  }
}

/** HH:MM in Manila, `offset` minutes from now, for hours that depend on the clock. */
async function manilaTime(offset: number) {
  const sql = db()
  try {
    const [row] = await sql<{ t: string }[]>`
      select to_char((now() at time zone 'Asia/Manila') + make_interval(mins => ${offset}), 'HH24:MI') as t`
    if (!row) throw new Error('no time')
    return row.t
  } finally {
    await sql.end()
  }
}

async function curatedTagId(label: string) {
  const sql = db()
  try {
    const [row] = await sql<
      { id: string }[]
    >`select id from public.curated_tags where label = ${label}`
    if (!row) throw new Error(`No curated tag labelled ${label}`)
    return row.id
  } finally {
    await sql.end()
  }
}

/** Holds a unit as a Seeker, through hold_unit itself; paid too when `pay` is set. */
async function holdAs(seekerId: string, unitId: string, pay = false) {
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
      await tx`select public.attach_checkout_session(${id}, ${'cs_test_e2e_sql_' + id.slice(0, 8)}, ${STRIPE_STUB_URL + '/pay/none'})`
      if (pay) {
        await tx.unsafe('reset role')
        await tx`select public.confirm_payment(${id}, ${'cs_test_e2e_sql_' + id.slice(0, 8)}, ${'pi_test_e2e_sql_' + id.slice(0, 8)})`
      }
    })
    return id
  } finally {
    await sql.end()
  }
}

async function reservation(id: string) {
  const sql = db()
  try {
    const [row] = await sql<
      {
        status: string
        booking_token: string | null
        payment: string
        session: string | null
      }[]
    >`
      select r.status, r.booking_token, p.status as payment, p.checkout_session_id as session
      from public.reservations r join public.payments p on p.reservation_id = r.id
      where r.id = ${id}`
    if (!row) throw new Error(`No reservation ${id}`)
    return row
  } finally {
    await sql.end()
  }
}

/**
 * Removes this file's Spaces, its sign-up, and the seeded Seekers' active holds (a Seeker
 * may hold one unit at a time, so another file's hold would refuse this file's).
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
    await sql`delete from auth.users where email like ${SIGNUP_PREFIX + '%@example.test'}`
  } finally {
    await sql.end()
  }
}

async function signIn(page: Page, email: string, returnUrl = '/') {
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

const holdButton = (page: Page) => page.getByRole('button', { name: 'Hold this unit' })

/** Holds P1 through the profile's panel and returns the hold's id. */
async function holdThroughPanel(page: Page, space: Fixture, wait = '30 min') {
  await page.goto(`/spaces/${space.id}?unit=${space.units.P1}`)
  await page.getByRole('radio', { name: wait }).check()
  await holdButton(page).click()
  await expect(page).toHaveURL(/\/seeker\/reservations\/[0-9a-f-]{36}$/)
  return page.url().split('/').pop() ?? ''
}

let stub: StripeStub

test.describe('Seeker journey (docs/flows/seeker-journey.md)', () => {
  test.beforeAll(async () => {
    stub = await startStripeStub()
  })
  test.afterAll(async () => {
    await cleanup()
    await stub.close()
  })
  test.beforeEach(cleanup)

  test('seeker-search-no-results, seeker-search-matches, seeker-filters-and-verification: a Seeker revises a search with no results, opens a match, and filters with AND, never by custom tags or into non-Verified Spaces', async ({
    page,
  }) => {
    const base = uniqueName('Findable')
    const tags = ['Wi-Fi: Fast (50+ Mbps)', 'Air Conditioning']
    const verified = await makeSpace(`${base} A`, {
      curated: tags,
      custom: ['Journey nook'],
    })
    await makeSpace(`${base} B`, { status: 'pending', curated: tags })

    await page.goto('/spaces')
    const search = page.getByTestId('discovery-search-input')
    await search.fill('zzqx no such space anywhere')
    await page.getByTestId('search-submit-button').click()
    await expect(
      page.getByText('No study spaces found matching your criteria.'),
    ).toBeVisible()

    await search.fill(base)
    await page.getByTestId('search-submit-button').click()
    await expect(page.getByText(verified.name).first()).toBeVisible()
    await expect(page.getByText(`${base} B`)).toHaveCount(0)

    const fast = await curatedTagId('Wi-Fi: Fast (50+ Mbps)')
    const ac = await curatedTagId('Air Conditioning')
    const ultra = await curatedTagId('Wi-Fi: Ultra-Fast (100+ Mbps)')
    await page.goto(`/spaces?q=${encodeURIComponent(base)}&tags=${fast}&tags=${ac}`)
    await expect(page.getByText(verified.name).first()).toBeVisible()
    await expect(page.getByText(`${base} B`)).toHaveCount(0)
    await page.goto(`/spaces?q=${encodeURIComponent(base)}&tags=${fast}&tags=${ultra}`)
    await expect(
      page.getByText('No study spaces found matching your criteria.'),
    ).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Journey nook/ })).toHaveCount(0)

    await page.goto(`/spaces?q=${encodeURIComponent(base)}`)
    await page
      .locator('article')
      .filter({ hasText: verified.name })
      .getByRole('link', { name: /View Space/ })
      .click()
    await expect(page).toHaveURL(new RegExp(`/spaces/${verified.id}`))
    await expect(
      page.getByRole('heading', { level: 1, name: verified.name }),
    ).toBeVisible()
  })

  test('seeker-space-closed, seeker-wait-window-before-close, seeker-no-wait-window-fits: a closed Space offers no hold, and the wait windows on offer end before closing time', async ({
    browser,
  }) => {
    const closed = await makeSpace(uniqueName('Closed'), {
      opens: await manilaTime(120),
      closes: await manilaTime(180),
    })
    const soon = await makeSpace(uniqueName('Closing soon'), {
      opens: await manilaTime(-60),
      closes: await manilaTime(50),
    })
    const tooSoon = await makeSpace(uniqueName('Closing now'), {
      opens: await manilaTime(-60),
      closes: await manilaTime(20),
    })
    const seeker = await newPage(browser, 'seeker2@example.test', '/seeker')

    await seeker.goto(`/spaces/${closed.id}?unit=${closed.units.P1}`)
    await expect(seeker.getByText('This Space is closed now').first()).toBeVisible()
    await expect(holdButton(seeker)).toHaveCount(0)

    // Paying takes up to 10 minutes, so with 50 minutes left only 15 and 30 fit.
    await seeker.goto(`/spaces/${soon.id}?unit=${soon.units.P1}`)
    await expect(seeker.getByRole('radio', { name: '15 min' })).toBeVisible()
    await expect(seeker.getByRole('radio', { name: '30 min' })).toBeVisible()
    await expect(seeker.getByRole('radio', { name: '45 min' })).toHaveCount(0)
    await expect(seeker.getByRole('radio', { name: '1 hr' })).toHaveCount(0)
    await expect(holdButton(seeker)).toBeVisible()

    await seeker.goto(`/spaces/${tooSoon.id}?unit=${tooSoon.units.P1}`)
    await expect(
      seeker.getByText(/No wait window fits before this Space closes/),
    ).toBeVisible()
    await expect(holdButton(seeker)).toHaveCount(0)
  })

  test('seeker-profile-no-available-unit: a profile whose units are all taken offers no hold', async ({
    browser,
  }) => {
    const full = await makeSpace(uniqueName('Full'), { occupied: true })
    const seeker = await newPage(browser, 'seeker2@example.test', '/seeker')
    await seeker.goto(`/spaces/${full.id}?unit=${full.units.P1}`)
    await expect(
      seeker.getByRole('list', { name: 'Zone availability breakdown' }),
    ).toContainText(/Desks:\s*0 available/)
    await expect(holdButton(seeker)).toHaveCount(0)
    await expect(seeker.getByRole('link', { name: 'Back to search' })).toBeVisible()
  })

  test('seeker-signed-out-hold, seeker-login-returns-to-profile, seeker-non-seeker-role-cannot-hold: a signed-out visitor is asked to sign in and comes back to pick the unit again; a Host or Administrator is told holds need a Seeker account', async ({
    page,
    browser,
  }) => {
    const space = await makeSpace(uniqueName('Sign in'))

    await page.goto(`/spaces/${space.id}?unit=${space.units.P1}`)
    await expect(page.getByText('Holding a unit needs a Seeker account.')).toBeVisible()
    await expect(holdButton(page)).toHaveCount(0)
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login\?returnUrl=/)
    await page.getByLabel('Email').fill('seeker2@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(`/spaces/${space.id}`)
    await expect(holdButton(page)).toHaveCount(0)
    await page.getByRole('link', { name: /^P1, Seat, Available/ }).click()
    await expect(holdButton(page)).toBeVisible()

    for (const email of ['host2@example.test', 'admin@example.test']) {
      const other = await newPage(
        browser,
        email,
        email.startsWith('host') ? '/host' : '/admin',
      )
      await other.goto(`/spaces/${space.id}?unit=${space.units.P1}`)
      await expect(other.getByText('Only Seeker accounts can hold units.')).toBeVisible()
      await expect(holdButton(other)).toHaveCount(0)
      await expect(other.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
    }
  })

  test('seeker-registration-returns-to-profile: registering from the hold panel comes back to the profile to pick the unit again', async ({
    page,
  }) => {
    const space = await makeSpace(uniqueName('Register'))
    await page.goto(`/spaces/${space.id}?unit=${space.units.P1}`)
    await page.getByRole('link', { name: 'Create a Seeker account' }).click()
    await expect(page).toHaveURL(/\/register\?returnUrl=/)
    await expect(page.getByRole('radio', { name: 'Seeker', exact: true })).toBeChecked()
    await page.getByLabel('Full name').fill('Journey Seeker')
    await page.getByLabel('Email').fill(`${SIGNUP_PREFIX}${Date.now()}@example.test`)
    await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
    await page.getByLabel('Confirm password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(`/spaces/${space.id}`)
    await expect(holdButton(page)).toHaveCount(0)
    await page.getByRole('link', { name: /^P1, Seat, Available/ }).click()
    await expect(holdButton(page)).toBeVisible()
  })

  test('seeker-select-available-unit, seeker-signed-in-hold, seeker-hold-available-unit, seeker-existing-hold-opens-dashboard, seeker-cancel-pending-hold: a Seeker picks a unit and a wait window, holds it, is pointed to that hold from another Space, and cancels it', async ({
    browser,
  }) => {
    const first = await makeSpace(uniqueName('Hold'))
    const second = await makeSpace(uniqueName('Second'))
    const seeker = await newPage(browser, 'seeker2@example.test', '/seeker')

    await seeker.goto(`/spaces/${first.id}`)
    await seeker.getByRole('link', { name: /^P1, Seat, Available/ }).click()
    await expect(seeker.getByRole('heading', { name: 'Hold P1' })).toBeVisible()
    await expect(seeker.getByRole('radio', { name: '15 min' })).toBeChecked()
    const holdId = await holdThroughPanel(seeker, first, '30 min')
    await expect(seeker.getByText('Pending Payment').first()).toBeVisible()
    expect((await reservation(holdId)).status).toBe('pending_payment')

    await seeker.goto(`/spaces/${second.id}?unit=${second.units.P1}`)
    await expect(
      seeker.getByText(
        `You're already holding P1 at ${first.name}. You can hold one unit at a time.`,
      ),
    ).toBeVisible()
    await expect(holdButton(seeker)).toHaveCount(0)
    await expect(seeker.locator(`a[href*="/seeker"]`).first()).toBeVisible()

    await seeker.goto(`/seeker/reservations/${holdId}`)
    await seeker.getByRole('link', { name: 'Cancel hold' }).click()
    await seeker.getByRole('button', { name: 'Cancel hold' }).click()
    await expect.poll(async () => (await reservation(holdId)).status).toBe('cancelled')
    await seeker.goto(`/spaces/${first.id}`)
    await expect(seeker.getByRole('link', { name: /^P1, Seat, Available/ })).toBeVisible()
  })

  test('seeker-hold-stale-unit-refresh: a hold on a unit someone else just took explains why it cannot go ahead', async ({
    browser,
  }) => {
    const space = await makeSpace(uniqueName('Stale'))
    const seeker = await newPage(browser, 'seeker2@example.test', '/seeker')
    await seeker.goto(`/spaces/${space.id}?unit=${space.units.P1}`)
    await expect(holdButton(seeker)).toBeVisible()

    await holdAs(SEEKER_1, space.units.P1)
    await holdButton(seeker).click()
    await expect(
      seeker.getByText('Someone else just took P1. Pick another unit.'),
    ).toBeVisible()
  })

  test('seeker-continues-to-checkout, seeker-payment-failure-retry, seeker-payment-confirming-waits-for-webhook, seeker-hold-and-pay: confirmation page shows waiting state until webhook completes, after a cancelled checkout, then Reserved with one booking token', async ({
    browser,
    request,
  }) => {
    const space = await makeSpace(uniqueName('Pay'))
    const seeker = await newPage(browser, 'seeker2@example.test', '/seeker')
    const holdId = await holdThroughPanel(seeker, space)

    // The Seeker goes on to the (stub) checkout, then cancels there.
    await seeker.getByRole('button', { name: 'Continue to payment' }).click()
    await expect(seeker).toHaveURL(new RegExp(`^${STRIPE_STUB_URL}/pay/cs_test_e2e_`))
    expect(stub.sessions.filter((s) => s.reservationId === holdId)).toHaveLength(1)
    await seeker.getByRole('link', { name: 'Cancel' }).click()
    await expect(seeker).toHaveURL(
      new RegExp(`/seeker/reservations/${holdId}/confirmation\\?status=cancelled`),
    )
    await expect(
      seeker.getByRole('button', { name: 'Continue to payment' }),
    ).toBeVisible()
    expect((await reservation(holdId)).status).toBe('pending_payment')

    // Back to the same checkout, and paying: the return page waits for the webhook,
    // without starting another checkout.
    await seeker.getByRole('button', { name: 'Continue to payment' }).click()
    await expect(seeker).toHaveURL(new RegExp(`^${STRIPE_STUB_URL}/pay/`))
    await seeker.getByRole('link', { name: 'Pay' }).click()
    await expect(seeker).toHaveURL(
      new RegExp(`/seeker/reservations/${holdId}/confirmation$`),
    )
    await expect(seeker.getByText('Confirming your payment with Stripe…')).toBeVisible()
    expect(stub.sessions.filter((s) => s.reservationId === holdId)).toHaveLength(1)

    const session = (await reservation(holdId)).session
    expect(session).toMatch(/^cs_test_e2e_/)
    const event = signedCheckoutCompleted(holdId, session ?? '')
    const response = await request.post('/api/webhooks/stripe', {
      data: event.body,
      headers: {
        'content-type': 'application/json',
        'stripe-signature': event.signature,
      },
    })
    expect(response.ok()).toBe(true)

    await expect(seeker.getByText('Reserved').first()).toBeVisible({ timeout: 20_000 })
    const paid = await reservation(holdId)
    expect(paid).toMatchObject({ status: 'reserved', payment: 'paid' })
    expect(paid.booking_token).toMatch(/^[0-9A-Z]{12}$/)
    const token = paid.booking_token ?? ''
    await expect(
      seeker
        .getByText(`${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}`)
        .first(),
    ).toBeVisible()
  })

  test('seeker-unpaid-hold-host-override, seeker-paid-hold-host-override: a Host override ends an unpaid hold and a paid one, and each Seeker is told what happened', async ({
    browser,
  }) => {
    const space = await makeSpace(uniqueName('Override'))
    const unpaid = await holdAs(SEEKER_2, space.units.P1)
    const paid = await holdAs(SEEKER_1, space.units.P2, true)

    const host = await newPage(browser, 'host@example.test', '/host')
    await host.goto(`/host/spaces/${space.id}/occupancy`)
    await host.getByRole('button', { name: 'List View' }).click()
    for (const label of ['P1', 'P2'] as const) {
      await host
        .getByRole('group', { name: `Occupancy controls for ${label}` })
        .filter({ visible: true })
        .getByRole('button', { name: `Mark ${label} as Available` })
        .click()
      const dialog = host.getByRole('alertdialog')
      await expect(dialog.getByText('Override active hold?')).toBeVisible()
      await dialog.getByRole('button', { name: 'Cancel hold and mark Available' }).click()
      await expect(dialog).toHaveCount(0)
    }
    await expect.poll(async () => (await reservation(unpaid)).status).toBe('cancelled')
    await expect.poll(async () => (await reservation(paid)).status).toBe('cancelled')

    const seeker2 = await newPage(browser, 'seeker2@example.test', '/seeker')
    await seeker2.goto(`/seeker/reservations/${unpaid}`)
    await expect(seeker2.getByText('Your hold on P1 has ended.')).toBeVisible()
    await seeker2.goto(`/spaces/${space.id}`)
    await expect(
      seeker2.getByRole('link', { name: /^P1, Seat, Available/ }),
    ).toBeVisible()

    const seeker1 = await newPage(browser, 'seeker@example.test', '/seeker')
    await seeker1.goto(`/seeker/reservations/${paid}`)
    await expect(
      seeker1.getByText(
        'Your ₱50.00 payment was recorded, and an Administrator can refund it.',
      ),
    ).toBeVisible()
  })

  test('seeker-payment-window-lapses-unpaid, seeker-payment-window-lapses-paid: an unpaid hold whose payment window ran out returns its unit, and a payment that arrives late is recorded for a refund', async ({
    browser,
  }) => {
    const space = await makeSpace(uniqueName('Lapse'))
    const unpaid = await holdAs(SEEKER_2, space.units.P1)
    const late = await holdAs(SEEKER_1, space.units.P2)
    const sql = db()
    try {
      await sql`
        update public.reservations set payment_window_ends_at = now() - interval '1 second'
        where id in (${unpaid}, ${late})`
      // The next read records the lapse (D-011), and then the late payment arrives (P2).
      await sql`select * from public.unit_states(${space.id})`
      await sql`select public.confirm_payment(${late}, ${'cs_test_e2e_sql_' + late.slice(0, 8)}, ${'pi_test_e2e_late_' + late.slice(0, 8)})`
    } finally {
      await sql.end()
    }
    expect((await reservation(unpaid)).status).toBe('expired')
    expect(await reservation(late)).toMatchObject({ status: 'expired', payment: 'paid' })

    const seeker2 = await newPage(browser, 'seeker2@example.test', '/seeker')
    await seeker2.goto(`/seeker/reservations/${unpaid}`)
    await expect(seeker2.getByText(/Your payment window ran out/).first()).toBeVisible()
    await seeker2.goto(`/spaces/${space.id}`)
    await expect(
      seeker2.getByRole('link', { name: /^P1, Seat, Available/ }),
    ).toBeVisible()

    const seeker1 = await newPage(browser, 'seeker@example.test', '/seeker')
    await seeker1.goto(`/seeker/reservations/${late}`)
    await expect(
      seeker1.getByText(
        'Your ₱50.00 payment was recorded, and an Administrator can refund it.',
      ),
    ).toBeVisible()
  })
})
