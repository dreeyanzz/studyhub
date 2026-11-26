import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import postgres from 'postgres'

/**
 * Reservation history E2E journey (STORY-16 design §4, TSK-16.5, #386, D-077, D-081).
 *
 * Creates its own Spaces, units, and paid, finished visits as postgres, and removes them
 * in afterAll, as e2e/seeker-journey.spec.ts and e2e/reviews.spec.ts do. Every account
 * is @example.test, so no confirmation email is ever sent (STORY-16 design §2, D-013).
 */

const SEED_PASSWORD = 'Worq-demo-2026'
const DATABASE_URL =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded test accounts (supabase/seed.sql):
// - host@example.test owns both fixture Spaces.
// - seeker@example.test has the finished visits.
const HOST_ID = 'b0000000-0000-4000-8000-000000000001'
const SEEKER_ID = 'c0000000-0000-4000-8000-000000000001'
const SEEKER_EMAIL = 'seeker@example.test'
const NAME_PREFIX = 'History Journey'
const HISTORY_URL = '/seeker/reservations'

interface Visit {
  reservationId: string
  unitId: string
  unitLabel: string
}

interface HistoryFixture {
  listedSpaceId: string
  listedSpaceName: string
  unlistedSpaceId: string
  unlistedSpaceName: string
  /** On the listed Space, Available now. */
  available: Visit
  /** On the listed Space, Occupied now (the Host's state), so Hold again says why. */
  taken: Visit
  /** On the Space that isn't Verified, so the history offers no Hold again. */
  unlisted: Visit
}

function db() {
  return postgres(DATABASE_URL, { max: 1 })
}

async function cleanupFixtures() {
  const sql = db()
  try {
    // Reviews and payments go with their reservations.
    await sql`
      delete from public.reservations
      where space_id in (
        select id from public.spaces
        where host_id = ${HOST_ID} and name like ${NAME_PREFIX + ' %'}
      )
    `
    await sql`
      delete from public.spaces
      where host_id = ${HOST_ID} and name like ${NAME_PREFIX + ' %'}
    `
  } finally {
    await sql.end()
  }
}

type Sql = ReturnType<typeof db>

async function insertSpace(sql: Sql, name: string, status: 'verified' | 'pending') {
  // Open around the clock ('00:00' to '00:00'), so Hold again never meets a closed Space.
  const [space] = await sql<{ id: string }[]>`
    insert into public.spaces
      (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
    values
      (${HOST_ID}, ${name}, '16 History Lane, Cebu City', '00:00', '00:00',
       ${status}, interval '1 hour', 10.3541, 123.9116, 'budget')
    returning id
  `
  if (!space) throw new Error(`Failed to create fixture Space ${name}`)

  const [zone] = await sql<{ id: string }[]>`
    insert into public.zones (space_id, name, position)
    values (${space.id}, 'Main Desk', 0)
    returning id
  `
  if (!zone) throw new Error(`Failed to create fixture Zone for ${name}`)

  return { spaceId: space.id, zoneId: zone.id }
}

async function insertUnit(
  sql: Sql,
  spaceId: string,
  zoneId: string,
  label: string,
  gridCol: number,
  hostState: 'available' | 'occupied',
) {
  const [unit] = await sql<{ id: string }[]>`
    insert into public.units
      (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span, host_state)
    values
      (${spaceId}, ${zoneId}, 'seat', ${label}, 0, ${gridCol}, 1, ${hostState})
    returning id
  `
  if (!unit) throw new Error(`Failed to create fixture unit ${label}`)
  return unit.id
}

/**
 * A paid hold that was checked in and finished: `completed`, with a `paid` payment.
 * `startMinutesAgo` is when it was held, so the newest-first history lists these near the top.
 */
async function insertFinishedVisit(
  sql: Sql,
  spaceId: string,
  unitId: string,
  unitLabel: string,
  startMinutesAgo: number,
): Promise<Visit> {
  const start = `${startMinutesAgo} minutes`
  const [reservation] = await sql<{ id: string }[]>`
    insert into public.reservations (
      seeker_id, space_id, unit_id, unit_label, status, wait_window,
      payment_window_ends_at, wait_window_ends_at, booking_token,
      checked_in_at, checked_out_at, ended_at, created_at
    )
    values (
      ${SEEKER_ID}, ${spaceId}, ${unitId}, ${unitLabel}, 'completed', interval '60 minutes',
      now() - ${start}::interval + interval '10 minutes',
      now() - ${start}::interval + interval '65 minutes',
      private.new_booking_token(),
      now() - ${start}::interval + interval '60 minutes',
      now() - ${start}::interval + interval '170 minutes',
      now() - ${start}::interval + interval '170 minutes',
      now() - ${start}::interval
    )
    returning id
  `
  if (!reservation) throw new Error(`Failed to create fixture visit on ${unitLabel}`)

  const sessionSuffix = reservation.id.slice(0, 8)
  await sql`
    insert into public.payments (
      reservation_id, status, fee_amount,
      checkout_session_id, external_payment_id, paid_at, created_at
    )
    select
      ${reservation.id},
      'paid'::public.payment_status,
      s.fee_amount,
      ${'cs_test_hist_' + sessionSuffix},
      ${'pi_test_hist_' + sessionSuffix},
      now() - ${start}::interval + interval '5 minutes',
      now() - ${start}::interval
    from private.reservation_settings as s
    where s.id = true
  `

  return { reservationId: reservation.id, unitId, unitLabel }
}

async function createHistoryFixture(): Promise<HistoryFixture> {
  const stamp = Date.now()
  const listedSpaceName = `${NAME_PREFIX} Listed ${stamp}`
  const unlistedSpaceName = `${NAME_PREFIX} Unlisted ${stamp}`
  const sql = db()
  try {
    const listed = await insertSpace(sql, listedSpaceName, 'verified')
    const availableUnitId = await insertUnit(
      sql,
      listed.spaceId,
      listed.zoneId,
      'H1',
      0,
      'available',
    )
    const takenUnitId = await insertUnit(
      sql,
      listed.spaceId,
      listed.zoneId,
      'H2',
      1,
      'available',
    )

    const unlisted = await insertSpace(sql, unlistedSpaceName, 'pending')
    const unlistedUnitId = await insertUnit(
      sql,
      unlisted.spaceId,
      unlisted.zoneId,
      'U1',
      0,
      'available',
    )

    // Held three hours ago, so each visit finished ten minutes ago.
    const available = await insertFinishedVisit(
      sql,
      listed.spaceId,
      availableUnitId,
      'H1',
      180,
    )
    const taken = await insertFinishedVisit(sql, listed.spaceId, takenUnitId, 'H2', 181)
    const unlistedVisit = await insertFinishedVisit(
      sql,
      unlisted.spaceId,
      unlistedUnitId,
      'U1',
      182,
    )

    // The Host marks H2 Occupied now, after the visit, so the profile reads it as taken.
    await sql`update public.units set host_state = 'occupied' where id = ${takenUnitId}`

    return {
      listedSpaceId: listed.spaceId,
      listedSpaceName,
      unlistedSpaceId: unlisted.spaceId,
      unlistedSpaceName,
      available,
      taken,
      unlisted: unlistedVisit,
    }
  } finally {
    await sql.end()
  }
}

/** How many of the Seeker's holds on a Space are still active (D-001: Hold again holds nothing). */
async function countActiveHolds(spaceId: string): Promise<number> {
  const sql = db()
  try {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count
      from public.reservations
      where seeker_id = ${SEEKER_ID}
        and space_id = ${spaceId}
        and status in ('pending_payment', 'reserved', 'occupied')
    `
    return row?.count ?? 0
  } finally {
    await sql.end()
  }
}

async function signIn(page: Page, email: string, returnUrl: string) {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(returnUrl, { timeout: 20_000 })
}

async function openSeeker(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, SEEKER_EMAIL, HISTORY_URL)
  return { context, page }
}

/** The history card for one visit: its Space's name and its exact unit label. */
function historyRow(page: Page, spaceName: string, unitLabel: string): Locator {
  return page
    .getByTestId('history-row')
    .filter({ hasText: spaceName })
    .filter({ has: page.getByText(unitLabel, { exact: true }) })
}

/** Clicks the 48 x 48 px wrapping label for a 1-5 category rating radio. */
async function chooseRating(scope: Locator, category: string, score: number) {
  const radio = scope.getByRole('radio', { name: `${category} ${score} out of 5` })
  await radio.locator('..').click()
  await expect(radio).toBeChecked()
}

async function rateEverything(scope: Locator, score: number) {
  for (const category of ['Quietness', 'Wi-Fi reliability', 'Cleanliness', 'Comfort']) {
    await chooseRating(scope, category, score)
  }
}

test.describe('Reservation history journey (STORY-16, TSK-16.5)', () => {
  // Each journey signs in and crosses two or three pages, which the dev server may be
  // compiling for the first time (as accessibility.spec.ts and host-setup.spec.ts allow).
  test.describe.configure({ mode: 'serial', timeout: 90_000 })

  let fixture: HistoryFixture

  test.beforeAll(async () => {
    await cleanupFixtures()
    fixture = await createHistoryFixture()
  })

  test.afterAll(async () => {
    await cleanupFixtures()
  })

  test('a finished visit is in the history, and is reviewed and then edited from there (RV1, RV2)', async ({
    browser,
  }) => {
    const { context, page } = await openSeeker(browser)

    try {
      const { listedSpaceId, listedSpaceName, available } = fixture
      const row = historyRow(page, listedSpaceName, available.unitLabel)
      await expect(row).toHaveCount(1)
      await expect(row).toContainText('Visit completed')
      await expect(row).toContainText('paid')
      await expect(row.getByRole('link', { name: listedSpaceName })).toHaveAttribute(
        'href',
        `/spaces/${listedSpaceId}`,
      )

      // 1. Leave a review in the dialog (RV1)
      await row.getByTestId(`leave-review-${available.reservationId}`).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole('heading', { name: `Leave a review — ${listedSpaceName}` }),
      ).toBeVisible()
      await rateEverything(dialog, 4)
      await dialog.getByLabel('Comment (optional)').fill('Reviewed from my history.')
      await dialog.getByRole('button', { name: 'Post review' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(row.getByTestId('review-live-status')).toContainText('Review posted.')
      await expect(row).toContainText('Reviewed')
      const editButton = row.getByRole('button', { name: 'Edit your review' })
      await expect(editButton).toBeVisible()
      await expect(row.getByRole('button', { name: 'Leave a review' })).toHaveCount(0)

      // 2. Edit your review in the dialog, prefilled with the saved values (RV2)
      await editButton.click()
      await expect(dialog).toBeVisible()
      await expect(dialog.getByLabel('Comment (optional)')).toHaveValue(
        'Reviewed from my history.',
      )
      await chooseRating(dialog, 'Comfort', 5)
      await dialog.getByLabel('Comment (optional)').fill('Edited from my history.')
      await dialog.getByRole('button', { name: 'Save changes' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(row.getByTestId('review-live-status')).toContainText('Review updated.')
      // Closing the dialog returns focus to its trigger (Radix, design §3 Screen 4).
      await expect(editButton).toBeFocused()

      // 3. The edit reached Postgres: the profile shows it, marked Edited
      await page.goto(`/spaces/${listedSpaceId}`)
      const authorGroup = page.getByTestId('author-reviews-group')
      await expect(authorGroup).toContainText('Edited from my history.')
      await expect(authorGroup.getByText('Edited', { exact: true })).toBeVisible()
    } finally {
      await context.close().catch(() => undefined)
    }
  })

  test('Hold again picks the unit when it is Available, and says why when it is taken (D-077)', async ({
    browser,
  }) => {
    const { context, page } = await openSeeker(browser)

    try {
      const { listedSpaceId, listedSpaceName, available, taken } = fixture

      // 1. Available: the profile opens with H1 picked and its hold panel ready
      await historyRow(page, listedSpaceName, available.unitLabel)
        .getByRole('link', { name: 'Hold again' })
        .click()
      await expect(page).toHaveURL(
        `/spaces/${listedSpaceId}?unit=${available.unitId}&from=history`,
      )
      await expect(page.getByTestId('selected-unit-panel')).toContainText(
        `Selected Unit: ${available.unitLabel}`,
      )
      await expect(page.getByTestId('selected-unit-hold-action')).toBeVisible()
      await expect(page.getByTestId('hold-again-notice')).toHaveCount(0)
      // Hold again never holds anything by itself (D-001, D-077).
      expect(await countActiveHolds(listedSpaceId)).toBe(0)

      // 2. Taken: the profile says why H2 can't be held, and offers no hold action
      await page.goto(HISTORY_URL)
      await historyRow(page, listedSpaceName, taken.unitLabel)
        .getByRole('link', { name: 'Hold again' })
        .click()
      await expect(page).toHaveURL(
        `/spaces/${listedSpaceId}?unit=${taken.unitId}&from=history`,
      )
      await expect(page.getByTestId('hold-again-notice')).toContainText(
        `${taken.unitLabel} is taken right now (Occupied). Pick another Available unit below.`,
      )
      await expect(page.getByTestId('selected-unit-panel')).toContainText(
        `Selected Unit: ${taken.unitLabel}`,
      )
      await expect(page.getByTestId('selected-unit-hold-action')).toHaveCount(0)
      expect(await countActiveHolds(listedSpaceId)).toBe(0)
    } finally {
      await context.close().catch(() => undefined)
    }
  })

  test("a visit to a Space that isn't listed shows no Hold again, and can still be reviewed (D-081)", async ({
    browser,
  }) => {
    const { context, page } = await openSeeker(browser)

    try {
      const { unlistedSpaceName, unlisted } = fixture
      const row = historyRow(page, unlistedSpaceName, unlisted.unitLabel)
      await expect(row).toHaveCount(1)
      await expect(row).toContainText("This Space isn't listed right now")
      await expect(row.getByRole('link', { name: 'Hold again' })).toHaveCount(0)
      // The name is plain text, since the profile isn't public.
      await expect(row.getByRole('link', { name: unlistedSpaceName })).toHaveCount(0)

      await row.getByTestId(`leave-review-${unlisted.reservationId}`).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await rateEverything(dialog, 3)
      await dialog.getByRole('button', { name: 'Post review' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(row.getByTestId('review-live-status')).toContainText('Review posted.')
      await expect(row).toContainText('Reviewed')

      // The review state persists from Postgres, not only in the page
      await page.reload()
      const reloadedRow = historyRow(page, unlistedSpaceName, unlisted.unitLabel)
      await expect(reloadedRow).toContainText('Reviewed')
      await expect(
        reloadedRow.getByRole('button', { name: 'Edit your review' }),
      ).toBeVisible()
    } finally {
      await context.close().catch(() => undefined)
    }
  })
})
