import { expect, test, type Browser, type Page } from '@playwright/test'
import postgres from 'postgres'

/**
 * Role journey gap coverage (STORY-19 design §3 & §9, TSK-19.4, #356).
 *
 * Closes the end-to-end Playwright journeys on `main` not already walked by another
 * story's spec:
 * 1. Signed-out visitor: landing hero search (`/` -> `/spaces?q=...`, SRS §3.7.1,
 *    STORY-17) into a Verified Space profile and the Privacy Policy (`/privacy`, STORY-21).
 * 2. Seeker: profile editing on `/seeker` with validation, reload persistence, and
 *    clearing an optional phone number back to null (STORY-04).
 * 3. Administrator: hiding and restoring a reported review (RV4, RV6) and dismissing
 *    open reports without hiding the review (RP2, FR-5.2, D-080).
 *
 * Isolated fixtures and profile restoration keep the local stack and seeded accounts
 * clean for every other spec and pgTAP run (D-013, D-028).
 */

// Shared local/CI seed password (supabase/seed.sql). Never used against cloud dev.
const SEED_PASSWORD = 'Worq-demo-2026'

const DATABASE_URL =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded accounts and Space (supabase/seed.sql).
const HOST_ID = 'b0000000-0000-4000-8000-000000000001' // host@, Hugo Santos
const SEEKER_1_ID = 'c0000000-0000-4000-8000-000000000001' // seeker@, Sam Dela Cruz
const SEEKER_2_ID = 'c0000000-0000-4000-8000-000000000002' // seeker2@, Rina Bautista
const SEEDED_VERIFIED_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const NAME_PREFIX = 'Role Journey'

function db() {
  return postgres(DATABASE_URL, { max: 1 })
}

interface ModerationSpaceFixture {
  id: string
  name: string
  units: Record<'A1' | 'A2', string>
}

interface SeekerProfileSnapshot {
  fullName: string | null
  phoneNumber: string | null
}

async function readProfile(userId: string): Promise<SeekerProfileSnapshot> {
  const sql = db()
  try {
    const [row] = await sql<{ full_name: string | null; phone_number: string | null }[]>`
      select full_name, phone_number
      from public.profiles
      where id = ${userId}
    `
    if (!row) throw new Error(`Missing profile row for ${userId}`)
    return { fullName: row.full_name, phoneNumber: row.phone_number }
  } finally {
    await sql.end()
  }
}

async function restoreProfile(userId: string, snapshot: SeekerProfileSnapshot) {
  const sql = db()
  try {
    await sql`
      update public.profiles
      set full_name = ${snapshot.fullName}, phone_number = ${snapshot.phoneNumber}
      where id = ${userId}
    `
  } finally {
    await sql.end()
  }
}

async function makeVerifiedSpace(name: string): Promise<ModerationSpaceFixture> {
  const sql = db()
  try {
    const [space] = await sql<{ id: string }[]>`
      insert into public.spaces
        (host_id, name, address, opens_at, closes_at, status, max_wait_window, latitude, longitude, price_tier)
      values
        (${HOST_ID}, ${name}, '19 Journey Avenue, Cebu City', '00:00', '00:00', 'verified',
         interval '1 hour', 10.3541, 123.9116, 'budget')
      returning id
    `
    if (!space) throw new Error('Failed to create fixture Space')

    const [zone] = await sql<{ id: string }[]>`
      insert into public.zones (space_id, name, position)
      values (${space.id}, 'Desks', 0)
      returning id
    `
    if (!zone) throw new Error('Failed to create fixture Zone')

    const units = await sql<{ id: string; label: 'A1' | 'A2' }[]>`
      insert into public.units (space_id, zone_id, unit_type, label, grid_row, grid_col, col_span, host_state)
      values
        (${space.id}, ${zone.id}, 'seat', 'A1', 0, 0, 1, 'available'),
        (${space.id}, ${zone.id}, 'seat', 'A2', 0, 1, 1, 'available')
      returning id, label
    `
    const byLabel = Object.fromEntries(
      units.map((u) => [u.label, u.id]),
    ) as ModerationSpaceFixture['units']

    return { id: space.id, name, units: byLabel }
  } finally {
    await sql.end()
  }
}

async function insertReviewedVisit(
  space: ModerationSpaceFixture,
  unit: 'A1' | 'A2',
  seekerId: string,
  rating: number,
  comment: string,
): Promise<string> {
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
      returning id
    `
    if (!visit) throw new Error('Failed to create fixture visit')

    await sql`
      insert into public.payments
        (reservation_id, status, fee_amount, checkout_session_id, external_payment_id, paid_at)
      values (
        ${visit.id}, 'paid', 5000, ${'cs_test_rj_' + visit.id.slice(0, 8)},
        ${'pi_test_rj_' + visit.id.slice(0, 8)}, now() - interval '2 days 2 hours 55 minutes'
      )
    `

    const [review] = await sql<{ id: string }[]>`
      insert into public.reviews
        (reservation_id, space_id, author_id, quietness, wifi_reliability, cleanliness, comfort, comment)
      values
        (${visit.id}, ${space.id}, ${seekerId}, ${rating}, ${rating}, ${rating}, ${rating}, ${comment})
      returning id
    `
    if (!review) throw new Error('Failed to create fixture review')
    return review.id
  } finally {
    await sql.end()
  }
}

async function insertReport(reviewId: string, reporterId: string, note: string) {
  const sql = db()
  try {
    await sql`
      insert into public.review_reports (review_id, reporter_id, reason, note)
      values (${reviewId}, ${reporterId}, 'other', ${note})
    `
  } finally {
    await sql.end()
  }
}

async function cleanupFixtureSpaces() {
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

async function signIn(page: Page, email: string, returnUrl: string) {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(returnUrl)
}

async function openContextPage(browser: Browser, email?: string, returnUrl = '/') {
  const context = await browser.newContext()
  const page = await context.newPage()
  if (email) {
    await signIn(page, email, returnUrl)
  }
  return { context, page }
}

test.describe('Role journey gap coverage (STORY-19, TSK-19.4)', () => {
  let originalSeekerProfile: SeekerProfileSnapshot

  test.beforeAll(async () => {
    originalSeekerProfile = await readProfile(SEEKER_1_ID)
    await cleanupFixtureSpaces()
  })

  test.beforeEach(async () => {
    await cleanupFixtureSpaces()
  })

  test.afterAll(async () => {
    await cleanupFixtureSpaces()
    await restoreProfile(SEEKER_1_ID, originalSeekerProfile)
  })

  test('Signed-out visitor searches from the landing hero, opens a Verified Space profile, and reads the Privacy Policy', async ({
    page,
  }) => {
    await page.goto('/')

    const heroSearch = page.getByRole('search', { name: 'Search study Spaces' })
    await expect(heroSearch).toBeVisible()
    await heroSearch.getByLabel('Search by campus, city, or Space name').fill('Kapihan')
    await heroSearch.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/\/spaces\?q=Kapihan$/)
    await expect(page.getByTestId('discovery-shell')).toBeVisible()

    const list = page.getByTestId('space-card-list')
    const kapihanCard = list.getByTestId(`space-card-${SEEDED_VERIFIED_SPACE_ID}`)
    await expect(kapihanCard).toContainText('Kapihan Study Hall')
    // Non-Verified Spaces never appear in public search (D-055).
    await expect(list).not.toContainText('Kapihan Night Desk')

    await kapihanCard.getByRole('link', { name: 'Kapihan Study Hall' }).click()
    await expect(page).toHaveURL(`/spaces/${SEEDED_VERIFIED_SPACE_ID}`)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Kapihan Study Hall' }),
    ).toBeVisible()

    // Footer Privacy Policy link is accessible from public pages (STORY-21).
    await page
      .getByRole('navigation', { name: 'Footer' })
      .getByRole('link', { name: 'Privacy policy' })
      .click()
    await expect(page).toHaveURL('/privacy')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Back to home' }).click()
    await expect(page).toHaveURL('/')
  })

  test('Seeker updates profile details on /seeker, sees validation feedback, persists across reload, and clears optional phone number (STORY-04)', async ({
    page,
  }) => {
    try {
      await signIn(page, 'seeker@example.test', '/seeker')

      const profileForm = page.locator('form', {
        has: page.getByRole('button', { name: 'Save Profile' }),
      })
      const fullNameInput = profileForm.getByLabel('Full Name')
      const phoneInput = profileForm.getByLabel('Phone Number')
      const saveButton = profileForm.getByRole('button', { name: 'Save Profile' })

      await expect(fullNameInput).toHaveValue(originalSeekerProfile.fullName ?? '')

      // Blank full name is refused with an accessible alert and focuses the invalid field.
      await fullNameInput.fill('   ')
      await saveButton.click()
      await expect(profileForm.getByRole('alert')).toContainText(
        'Please correct the errors in the form before saving.',
      )
      await expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
      await expect(fullNameInput).toBeFocused()

      // Save updated synthetic name and phone number, then verify reload persistence.
      await fullNameInput.fill('Sam Dela Cruz Jr.')
      await phoneInput.fill('+63 917 555 0101')
      await saveButton.click()
      await expect(profileForm.getByRole('status')).toContainText(
        'Profile changes saved.',
      )

      await page.reload()
      await expect(profileForm.getByLabel('Full Name')).toHaveValue('Sam Dela Cruz Jr.')
      await expect(profileForm.getByLabel('Phone Number')).toHaveValue('+63 917 555 0101')

      // Clearing the optional phone number persists as null in Postgres.
      await profileForm
        .getByLabel('Full Name')
        .fill(originalSeekerProfile.fullName ?? 'Sam Dela Cruz')
      await profileForm.getByLabel('Phone Number').fill('')
      await profileForm.getByRole('button', { name: 'Save Profile' }).click()
      await expect(profileForm.getByRole('status')).toContainText(
        'Profile changes saved.',
      )

      await page.reload()
      await expect(profileForm.getByLabel('Full Name')).toHaveValue(
        originalSeekerProfile.fullName ?? 'Sam Dela Cruz',
      )
      await expect(profileForm.getByLabel('Phone Number')).toHaveValue('')

      const stored = await readProfile(SEEKER_1_ID)
      expect(stored.phoneNumber).toBeNull()
    } finally {
      await restoreProfile(SEEKER_1_ID, originalSeekerProfile)
    }
  })

  test('Administrator hides and restores a reported review (RV4, RV6), and dismisses open reports without hiding (RP2, D-080)', async ({
    browser,
  }) => {
    const space = await makeVerifiedSpace(`${NAME_PREFIX} Moderation ${Date.now()}`)
    const keptComment = 'Steady Wi-Fi and plenty of outlets near the window.'
    const hiddenComment = 'Loud phone calls at the back table all afternoon.'

    const dismissedReviewId = await insertReviewedVisit(
      space,
      'A1',
      SEEKER_1_ID,
      5,
      keptComment,
    )
    const hiddenReviewId = await insertReviewedVisit(
      space,
      'A2',
      SEEKER_2_ID,
      1,
      hiddenComment,
    )

    await insertReport(
      hiddenReviewId,
      SEEKER_1_ID,
      'Needs a quick moderation check before staying public.',
    )
    await insertReport(
      dismissedReviewId,
      SEEKER_2_ID,
      'Reported by mistake; review accurately describes the Space.',
    )

    const visitorSession = await openContextPage(browser)
    const adminSession = await openContextPage(
      browser,
      'admin@example.test',
      '/admin/moderation',
    )

    try {
      const visitor = visitorSession.page
      const admin = adminSession.page

      // Before moderation: both reviews count toward the 3.0 average.
      await visitor.goto(`/spaces/${space.id}`)
      const reviewsSection = visitor.getByTestId('space-reviews-section')
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '3.0 · 2 reviews',
      )
      await expect(reviewsSection.getByTestId('space-reviews-list')).toContainText(
        hiddenComment,
      )

      // 1. Hide (RV4): review leaves the Reported tab, the profile, and the averages.
      const hideCard = admin.getByTestId(`moderation-review-${hiddenReviewId}`)
      await expect(hideCard).toContainText(space.name)
      await admin.getByTestId(`moderation-hide-${hiddenReviewId}`).click()
      const hideDialog = admin.getByRole('alertdialog')
      await expect(hideDialog.getByText('Hide review?')).toBeVisible()
      await hideDialog.getByTestId('moderation-confirm-action').click()
      await expect(admin.getByTestId('moderation-live-status')).toHaveText(
        'Review hidden.',
      )
      await expect(hideCard).toHaveCount(0)

      await visitor.reload()
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '5.0 · 1 review',
      )
      await expect(reviewsSection.getByTestId('space-reviews-list')).not.toContainText(
        hiddenComment,
      )

      // 2. Restore (RV6): Hidden tab records the history entry and restores the review.
      await admin.getByTestId('moderation-tab-hidden').click()
      await expect(admin).toHaveURL('/admin/moderation?list=hidden')
      const hiddenTabCard = admin.getByTestId(`moderation-review-${hiddenReviewId}`)
      await expect(hiddenTabCard).toContainText(space.name)
      await expect(
        admin.getByTestId(`moderation-history-${hiddenReviewId}`),
      ).toContainText('Hidden')

      await admin.getByTestId(`moderation-restore-${hiddenReviewId}`).click()
      const restoreDialog = admin.getByRole('alertdialog')
      await expect(restoreDialog.getByText('Restore review?')).toBeVisible()
      await restoreDialog.getByTestId('moderation-confirm-action').click()
      await expect(admin.getByTestId('moderation-live-status')).toHaveText(
        'Review restored.',
      )
      await expect(hiddenTabCard).toHaveCount(0)

      await visitor.reload()
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '3.0 · 2 reviews',
      )
      await expect(reviewsSection.getByTestId('space-reviews-list')).toContainText(
        hiddenComment,
      )

      // 3. Dismiss reports (RP2): leaves the review visible while clearing open reports.
      await admin.getByTestId('moderation-tab-reported').click()
      await expect(admin).toHaveURL('/admin/moderation?list=reported')
      const dismissCard = admin.getByTestId(`moderation-review-${dismissedReviewId}`)
      await expect(dismissCard).toContainText(space.name)
      await admin.getByTestId(`moderation-dismiss-${dismissedReviewId}`).click()
      const dismissDialog = admin.getByRole('alertdialog')
      await expect(dismissDialog.getByText('Dismiss reports?')).toBeVisible()
      await dismissDialog.getByTestId('moderation-confirm-action').click()
      await expect(admin.getByTestId('moderation-live-status')).toHaveText(
        'Reports dismissed.',
      )
      await expect(dismissCard).toHaveCount(0)

      await visitor.reload()
      await expect(reviewsSection.getByTestId('reviews-overall-rating')).toContainText(
        '3.0 · 2 reviews',
      )
      await expect(reviewsSection.getByTestId('space-reviews-list')).toContainText(
        keptComment,
      )
    } finally {
      await visitorSession.context.close()
      await adminSession.context.close()
    }
  })
})
