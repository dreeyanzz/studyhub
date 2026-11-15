import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

// Seed credentials apply only to local Supabase and CI (D-013, D-028).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded entities from supabase/seed.sql. Sulok Co-working is verified and 24-hour
// (00:00-00:00) so this journey does not depend on wall-clock Manila hours.
const KAPIHAN_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const SULOK_SPACE_ID = 'e0000000-0000-4000-8000-000000000003'
const UNIT_U1_ID = 'f0000000-0000-4000-8000-000000000017'
const UNIT_U2_ID = 'f0000000-0000-4000-8000-000000000018'
const UNIT_U3_ID = 'f0000000-0000-4000-8000-000000000019'
const SEEKER_1_ID = 'c0000000-0000-4000-8000-000000000001'

function getDb() {
  return postgres(databaseUrl, { max: 1 })
}

async function logInAs(page: Page, email: string, returnUrl?: string) {
  const url = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'
  await page.goto(url)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function cleanupCheckInState() {
  const sql = getDb()
  try {
    await sql`
      delete from public.reservations
      where seeker_id = ${SEEKER_1_ID}
         or unit_id in (${UNIT_U1_ID}, ${UNIT_U2_ID}, ${UNIT_U3_ID})
    `
    await sql`
      update public.units
      set host_state = 'available', host_updated_at = now()
      where space_id = ${SULOK_SPACE_ID}
        and id in (${UNIT_U1_ID}, ${UNIT_U2_ID}, ${UNIT_U3_ID})
    `
  } finally {
    await sql.end()
  }
}

async function confirmReservationPayment(reservationId: string) {
  const sql = getDb()
  try {
    const [result] = await sql`
      select public.confirm_payment(
        ${reservationId}::uuid,
        ${`cs_test_${reservationId}`},
        ${`pi_test_${reservationId}`}
      ) as outcome
    `
    const [row] = await sql`
      select booking_token
      from public.reservations
      where id = ${reservationId}::uuid
    `
    if (!row?.booking_token) {
      throw new Error(
        `confirm_payment did not assign a booking_token (outcome: ${JSON.stringify(result)})`,
      )
    }
    return row.booking_token as string
  } finally {
    await sql.end()
  }
}

test.describe('Check-in, wait-window timers, and unit release (STORY-10 TSK-10.5)', () => {
  test.beforeEach(async () => {
    await cleanupCheckInState()
  })

  test.afterEach(async () => {
    await cleanupCheckInState()
  })

  test('Seeker holds unit, Host views wait-window badge and checks in via Check-in desk, Seeker checks out (FR-2.3, FR-3.3, FR-3.4, FR-3.5)', async ({
    page,
    browser,
  }) => {
    // 1. Seeker reserves unit U1 at Sulok Co-working
    await logInAs(
      page,
      'seeker@example.test',
      `/spaces/${SULOK_SPACE_ID}?unit=${UNIT_U1_ID}`,
    )
    await expect(page.getByRole('button', { name: 'Hold this unit' })).toBeVisible()
    await page.getByRole('button', { name: 'Hold this unit' }).click()

    await expect(page).toHaveURL(/\/seeker\/reservations\/([0-9a-f-]+)/)
    const reservationId = page.url().match(/\/seeker\/reservations\/([0-9a-f-]+)/)?.[1]
    expect(reservationId).toBeTruthy()

    // 2. Simulate confirmed sandbox payment (runs confirm_payment SQL directly in CI)
    const rawToken = await confirmReservationPayment(reservationId!)
    const groupedToken = `${rawToken.slice(0, 4)}-${rawToken.slice(4, 8)}-${rawToken.slice(8, 12)}`

    // 3. Seeker sees Reserved hold, wait countdown, QR code, and grouped token on /seeker
    await page.goto('/seeker')
    await expect(page.getByText('Sulok Co-working')).toBeVisible()
    await expect(
      page.getByRole('img', { name: `Booking QR code for token ${groupedToken}` }),
    ).toBeVisible()
    await expect(page.getByText(groupedToken)).toBeVisible()

    // 4. Host inspects Host portal link, Occupancy wait-window badge, then checks Seeker in
    const hostContext = await browser.newContext()
    const hostPage = await hostContext.newPage()

    try {
      await logInAs(hostPage, 'host2@example.test', '/host')
      const deskLink = hostPage.getByRole('link', {
        name: 'Check-in desk for Sulok Co-working',
      })
      await expect(deskLink).toBeVisible()
      await expect(deskLink).toHaveAttribute(
        'href',
        `/host/spaces/${SULOK_SPACE_ID}/check-in`,
      )

      await hostPage.goto(`/host/spaces/${SULOK_SPACE_ID}/occupancy`)
      const waitBadge = hostPage.getByText(/Wait:\s+(?:<\s*1\s*min|\d+\s+min\s+left)/i)
      await expect(waitBadge.first()).toBeVisible()
      await expect(hostPage.getByRole('main')).not.toContainText(
        /real[- ]?time|\blive\b/i,
      )

      await hostPage.getByRole('link', { name: 'Check-in desk' }).click()
      await expect(hostPage).toHaveURL(`/host/spaces/${SULOK_SPACE_ID}/check-in`)

      const tokenInput = hostPage.getByLabel('Booking token')
      await tokenInput.fill(rawToken.toLowerCase())
      await expect(tokenInput).toHaveValue(groupedToken)
      await hostPage.getByRole('button', { name: 'Check In' }).click()

      await expect(hostPage.getByText(/Checked in unit U1/)).toBeVisible()

      await hostPage.goto(`/host/spaces/${SULOK_SPACE_ID}/occupancy`)
      await expect(hostPage.getByText(/1\s*\/\s*3\s*units occupied/)).toBeVisible()
      await expect(
        hostPage.getByText(/Wait:\s+(?:<\s*1\s*min|\d+\s+min\s+left|expired)/i),
      ).toHaveCount(0)

      // 5. Seeker refreshes /seeker, sees Checked In state, and checks out
      await page.reload()
      await expect(page.getByText(/Checked In · Unit U1/)).toBeVisible()

      await page.getByRole('link', { name: 'Check Out' }).click()
      await expect(page.getByRole('heading', { name: 'Check out of U1?' })).toBeVisible()
      await page.getByRole('button', { name: 'Check Out' }).click()

      await expect(page.getByRole('heading', { name: 'Visit completed' })).toBeVisible()

      // 6. Unit returns to Available (0/3 occupied) on Host occupancy view
      await hostPage.reload()
      await expect(hostPage.getByText(/0\s*\/\s*3\s*units occupied/)).toBeVisible()
    } finally {
      await hostContext.close()
    }
  })

  test('Host at another Space receives wrong_space without releasing the hold (C5)', async ({
    page,
    browser,
  }) => {
    await logInAs(
      page,
      'seeker@example.test',
      `/spaces/${SULOK_SPACE_ID}?unit=${UNIT_U2_ID}`,
    )
    await page.getByRole('button', { name: 'Hold this unit' }).click()
    await expect(page).toHaveURL(/\/seeker\/reservations\/([0-9a-f-]+)/)

    const reservationId = page.url().match(/\/seeker\/reservations\/([0-9a-f-]+)/)?.[1]
    expect(reservationId).toBeTruthy()
    const rawToken = await confirmReservationPayment(reservationId!)

    const otherHostContext = await browser.newContext()
    const otherHostPage = await otherHostContext.newPage()

    try {
      await logInAs(
        otherHostPage,
        'host@example.test',
        `/host/spaces/${KAPIHAN_SPACE_ID}/check-in`,
      )
      await expect(otherHostPage).toHaveURL(`/host/spaces/${KAPIHAN_SPACE_ID}/check-in`)

      await otherHostPage.getByLabel('Booking token').fill(rawToken)
      await otherHostPage.getByRole('button', { name: 'Check In' }).click()

      await expect(otherHostPage.getByText('Wrong Space')).toBeVisible()
      await expect(
        otherHostPage.getByText(
          'This reservation is for a different Space. No changes were made.',
        ),
      ).toBeVisible()
    } finally {
      await otherHostContext.close()
    }

    // Hold on Sulok Co-working must remain untouched in the database
    const sql = getDb()
    try {
      const [row] = await sql`
        select status, checked_in_at
        from public.reservations
        where id = ${reservationId!}::uuid
      `
      expect(row?.status).toBe('reserved')
      expect(row?.checked_in_at).toBeNull()
    } finally {
      await sql.end()
    }
  })
})
