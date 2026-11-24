import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import postgres from 'postgres'

/**
 * Community reviews and ratings E2E journey (STORY-13 design §4, TSK-13.5, FR-4.1, FR-4.2, D-080, D-081).
 *
 * Creates its own isolated Verified Space, Zone, Unit, and checked-in visit as postgres,
 * and removes them in afterAll so it never depends on seeded rows or other specs.
 */

const SEED_PASSWORD = 'Worq-demo-2026'
const DATABASE_URL =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded test accounts (supabase/seed.sql):
// - host@example.test owns the isolated fixture Space.
// - seeker@example.test ("Sam Dela Cruz" -> short name "Sam C.") has the checked-in visit.
// - seeker2@example.test ("Rina Bautista") reports Sam's visible review.
const HOST_ID = 'b0000000-0000-4000-8000-000000000001'
const SEEKER_1_ID = 'c0000000-0000-4000-8000-000000000001'
const SEEKER_1_EMAIL = 'seeker@example.test'
const SEEKER_2_EMAIL = 'seeker2@example.test'
const NAME_PREFIX = 'Reviews Journey'

interface ReviewFixture {
  spaceId: string
  spaceName: string
  reservationId: string
}

function db() {
  return postgres(DATABASE_URL, { max: 1 })
}

async function cleanupFixtures() {
  const sql = db()
  try {
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

async function createReviewFixture(): Promise<ReviewFixture> {
  const spaceName = `${NAME_PREFIX} Space ${Date.now()}`
  const sql = db()
  try {
    const [space] = await sql<{ id: string }[]>`
      insert into public.spaces
        (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
      values
        (${HOST_ID}, ${spaceName}, '99 Review Lane, Cebu City', '00:00', '00:00',
         'verified', interval '1 hour', 10.354, 123.9114, 'budget')
      returning id
    `
    if (!space) throw new Error('Failed to create review fixture Space')

    const [zone] = await sql<{ id: string }[]>`
      insert into public.zones (space_id, name, position)
      values (${space.id}, 'Main Desk', 0)
      returning id
    `
    if (!zone) throw new Error('Failed to create review fixture Zone')

    const [unit] = await sql<{ id: string }[]>`
      insert into public.units
        (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span, host_state)
      values
        (${space.id}, ${zone.id}, 'seat', 'R1', 0, 0, 1, 'available')
      returning id
    `
    if (!unit) throw new Error('Failed to create review fixture Unit')

    const [reservation] = await sql<{ id: string }[]>`
      insert into public.reservations (
        seeker_id, space_id, unit_id, unit_label, status, wait_window,
        payment_window_ends_at, wait_window_ends_at, booking_token,
        checked_in_at, checked_out_at, ended_at, created_at
      )
      values (
        ${SEEKER_1_ID}, ${space.id}, ${unit.id}, 'R1', 'completed', interval '60 minutes',
        now() - interval '2 days' - interval '2 hours 50 minutes',
        now() - interval '2 days' - interval '1 hour 55 minutes',
        private.new_booking_token(),
        now() - interval '2 days' - interval '2 hours',
        now() - interval '2 days',
        now() - interval '2 days',
        now() - interval '2 days' - interval '3 hours'
      )
      returning id
    `
    if (!reservation) throw new Error('Failed to create review fixture reservation')

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
        ${'cs_test_rev_' + sessionSuffix},
        ${'pi_test_rev_' + sessionSuffix},
        now() - interval '2 days' - interval '2 hours 55 minutes',
        now() - interval '2 days' - interval '3 hours'
      from private.reservation_settings as s
      where s.id = true
    `

    return { spaceId: space.id, spaceName, reservationId: reservation.id }
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

async function openContext(browser: Browser, email?: string, returnUrl = '/') {
  const context = await browser.newContext()
  const page = await context.newPage()
  if (email) {
    await signIn(page, email, returnUrl)
  }
  return { context, page }
}

/** Clicks the 48 x 48 px wrapping label for a 1-5 category rating radio. */
async function chooseRating(scope: Locator, category: string, score: number) {
  const radio = scope.getByRole('radio', { name: `${category} ${score} out of 5` })
  await radio.locator('..').click()
  await expect(radio).toBeChecked()
}

test.describe('Community reviews and ratings journey (STORY-13, TSK-13.5)', () => {
  test.describe.configure({ mode: 'serial' })

  let fixture: ReviewFixture

  test.beforeAll(async () => {
    await cleanupFixtures()
    fixture = await createReviewFixture()
  })

  test.afterAll(async () => {
    await cleanupFixtures()
  })

  test('Seeker posts a review, edits it (sees Edited), deletes it, and writes again (RV1-RV3)', async ({
    browser,
  }) => {
    const profileUrl = `/spaces/${fixture.spaceId}`
    const { context, page } = await openContext(browser, SEEKER_1_EMAIL, profileUrl)

    try {
      const reviewsSection = page.getByTestId('space-reviews-section')
      await expect(reviewsSection).toBeVisible()
      await expect(reviewsSection.getByTestId('reviews-empty-state')).toContainText(
        'No reviews yet',
      )

      // 1. Post the first review (RV1)
      const writePanel = reviewsSection.getByTestId('write-review-panel')
      await expect(writePanel).toBeVisible()
      await chooseRating(writePanel, 'Quietness', 5)
      await chooseRating(writePanel, 'Wi-Fi reliability', 4)
      await chooseRating(writePanel, 'Cleanliness', 5)
      await chooseRating(writePanel, 'Comfort', 4)
      await writePanel
        .getByLabel('Comment (optional)')
        .fill('Quiet desks and steady Wi-Fi for evening study.')
      await writePanel.getByRole('button', { name: 'Post review' }).click()

      await expect(reviewsSection.getByTestId('review-live-status')).toContainText(
        'Review posted.',
      )
      await expect(writePanel).not.toBeVisible()

      const authorGroup = reviewsSection.getByTestId('author-reviews-group')
      await expect(authorGroup).toBeVisible()
      await expect(authorGroup).toContainText('Your review')
      await expect(authorGroup).toContainText('Sam C.')
      await expect(authorGroup).toContainText('Checked-in visit')
      await expect(authorGroup).toContainText(
        'Quiet desks and steady Wi-Fi for evening study.',
      )
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '4.5 · 1 review',
      )

      // 2. Edit the review and see "Edited" (RV2)
      await authorGroup.getByRole('button', { name: 'Edit' }).click()
      await chooseRating(authorGroup, 'Wi-Fi reliability', 5)
      await chooseRating(authorGroup, 'Comfort', 5)
      await authorGroup
        .getByLabel('Comment (optional)')
        .fill('Updated after a full evening session.')
      await authorGroup.getByRole('button', { name: 'Save changes' }).click()

      await expect(reviewsSection.getByTestId('review-live-status')).toContainText(
        'Review updated.',
      )
      await expect(authorGroup).toContainText('Edited')
      await expect(authorGroup).toContainText('Updated after a full evening session.')
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '5.0 · 1 review',
      )

      // 3. Delete the review via AlertDialog confirmation (RV3) and post a fresh one
      await authorGroup.getByRole('button', { name: 'Delete' }).click()
      const alertDialog = page.getByRole('alertdialog')
      await expect(alertDialog).toBeVisible()
      await expect(alertDialog).toContainText('Delete this review?')
      await alertDialog.getByRole('button', { name: 'Delete review' }).click()

      await expect(reviewsSection.getByTestId('review-live-status')).toContainText(
        'Review deleted.',
      )
      await expect(authorGroup).not.toBeVisible()
      await expect(reviewsSection.getByTestId('reviews-empty-state')).toContainText(
        'No reviews yet',
      )
      await expect(writePanel).toBeVisible()

      // Re-post on the same visit (overall = 4.25 -> displays as 4.3)
      await chooseRating(writePanel, 'Quietness', 4)
      await chooseRating(writePanel, 'Wi-Fi reliability', 5)
      await chooseRating(writePanel, 'Cleanliness', 4)
      await chooseRating(writePanel, 'Comfort', 4)
      await writePanel.getByLabel('Comment (optional)').fill('Great outlets and cool AC.')
      await writePanel.getByRole('button', { name: 'Post review' }).click()

      await expect(reviewsSection.getByTestId('review-live-status')).toContainText(
        'Review posted.',
      )
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '4.3 · 1 review',
      )
      await expect(authorGroup).toContainText('Great outlets and cool AC.')
    } finally {
      await context.close().catch(() => undefined)
    }
  })

  test('Signed-out visitor reads the reviews, averages, and Space card rating (FR-4.1, N17)', async ({
    browser,
  }) => {
    const { context, page } = await openContext(browser)

    try {
      await page.goto(`/spaces/${fixture.spaceId}`)

      const reviewsSection = page.getByTestId('space-reviews-section')
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '4.3 · 1 review',
      )
      await expect(
        reviewsSection.getByRole('img', {
          name: 'Overall 4.3 out of 5, from 1 review',
        }),
      ).toBeVisible()

      const reviewList = reviewsSection.getByTestId('space-reviews-list')
      await expect(reviewList).toContainText('Sam C.')
      await expect(reviewList).not.toContainText('Sam Dela Cruz')
      await expect(reviewList).toContainText('Great outlets and cool AC.')
      // Signed-out visitors never see Write a review or Report controls
      await expect(reviewsSection.getByTestId('write-review-panel')).toHaveCount(0)
      await expect(reviewsSection.getByRole('button', { name: 'Report' })).toHaveCount(0)

      // Discovery Space card shows the same overall average and count
      await page.goto(`/spaces?q=${encodeURIComponent(fixture.spaceName)}`)
      const spaceCard = page.getByTestId(`space-card-${fixture.spaceId}`)
      await expect(spaceCard).toBeVisible()
      await expect(
        spaceCard.getByTestId(`space-rating-${fixture.spaceId}`),
      ).toContainText('4.3 · 1 review')
      await expect(
        spaceCard.getByRole('img', { name: 'Overall 4.3 out of 5, from 1 review' }),
      ).toBeVisible()
    } finally {
      await context.close().catch(() => undefined)
    }
  })

  test('Another Seeker reports the review and sees "You reported this" (RP1, FR-4.2, D-080)', async ({
    browser,
  }) => {
    const profileUrl = `/spaces/${fixture.spaceId}`
    const { context, page } = await openContext(browser, SEEKER_2_EMAIL, profileUrl)

    try {
      const reviewCard = page.getByTestId('space-reviews-list').locator('article').first()
      await expect(reviewCard).toContainText('Great outlets and cool AC.')

      await reviewCard.getByRole('button', { name: 'Report' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: 'Report review' })).toBeVisible()

      // Submitting without choosing a reason shows an inline validation error
      await dialog.getByRole('button', { name: 'Submit report' }).click()
      await expect(dialog.getByTestId('report-form-error')).toContainText(
        'Choose a reason for reporting this review.',
      )

      // Choose a reason, add a note, and submit
      await dialog.getByLabel('Not about this Space').check()
      await dialog.getByLabel('Note (optional)').fill('Testing report submission flow.')
      await expect(dialog).toContainText('269 / 300 characters remaining')
      await dialog.getByRole('button', { name: 'Submit report' }).click()

      await expect(dialog).not.toBeVisible()
      await expect(reviewCard).toContainText('Report submitted.')
      await expect(reviewCard).toContainText('You reported this')
      await expect(reviewCard.getByRole('button', { name: 'Report' })).toHaveCount(0)

      // Reload to verify reported_by_caller persists from Postgres
      await page.reload()
      const reloadedCard = page
        .getByTestId('space-reviews-list')
        .locator('article')
        .first()
      await expect(reloadedCard).toContainText('You reported this')
      await expect(reloadedCard.getByRole('button', { name: 'Report' })).toHaveCount(0)
    } finally {
      await context.close().catch(() => undefined)
    }
  })
})
