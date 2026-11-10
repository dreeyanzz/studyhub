import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

// The shared seed password for all local test accounts (supabase/seed.sql).
// Local and CI only (D-013). Never used against the cloud dev project (D-028).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded test IDs (supabase/seed.sql)
const SPACE_ID = 'e0000000-0000-4000-8000-000000000001' // Kapihan Study Hall (verified, host@)

const UNIT_S1_ID = 'f0000000-0000-4000-8000-000000000001'
const UNIT_S2_ID = 'f0000000-0000-4000-8000-000000000002'
const UNIT_S3_ID = 'f0000000-0000-4000-8000-000000000003'
const SEEKER_1_ID = 'c0000000-0000-4000-8000-000000000001' // Sam Dela Cruz

function getDb() {
  return postgres(databaseUrl, { max: 1 })
}

/**
 * Generates a valid 12-character Crockford base32 booking token (D-059).
 */
function generateCrockfordToken(): string {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let token = ''
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

/**
 * Generates an external payment ID for sandbox payments.
 */
function generatePaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Helper to log in as a specific seeded test user (N4).
 */
async function logInAs(page: Page, email: string, returnUrl?: string) {
  const url = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'
  await page.goto(url)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
}

/**
 * Resets reservations and host unit states for S1-S3 back to initial seed state (N2).
 */
async function cleanupOccupancyState() {
  const sql = getDb()
  try {
    await sql`
      delete from public.reservations
      where space_id = ${SPACE_ID}
        and unit_id in (${UNIT_S1_ID}, ${UNIT_S2_ID}, ${UNIT_S3_ID})
    `
    await sql`
      update public.units
      set host_state = 'available', host_updated_at = now()
      where space_id = ${SPACE_ID}
        and id in (${UNIT_S1_ID}, ${UNIT_S2_ID}, ${UNIT_S3_ID})
    `
  } finally {
    await sql.end()
  }
}

/**
 * Seeds a test reservation with valid database constraints for testing override and conflict flows.
 */
async function createTestReservation(
  unitId: string,
  unitLabel: string,
  status: 'pending_payment' | 'reserved' | 'occupied',
) {
  const sql = getDb()
  try {
    const bookingToken = status !== 'pending_payment' ? generateCrockfordToken() : null
    const [res] = await sql`
      insert into public.reservations (
        seeker_id,
        space_id,
        unit_id,
        unit_label,
        status,
        booking_token,
        wait_window,
        payment_window_ends_at,
        wait_window_ends_at
      ) values (
        ${SEEKER_1_ID},
        ${SPACE_ID},
        ${unitId},
        ${unitLabel},
        ${status},
        ${bookingToken},
        interval '30 minutes',
        now() + interval '15 minutes',
        ${status !== 'pending_payment' ? sql`now() + interval '30 minutes'` : null}
      )
      returning id
    `
    if (!res?.id) {
      throw new Error('Failed to insert test reservation')
    }

    const externalPaymentId = status !== 'pending_payment' ? generatePaymentId() : null
    await sql`
      insert into public.payments (
        reservation_id,
        status,
        fee_amount,
        external_payment_id,
        paid_at
      ) values (
        ${res.id},
        ${status === 'pending_payment' ? 'pending' : 'paid'},
        5000,
        ${externalPaymentId},
        ${status !== 'pending_payment' ? sql`now()` : null}
      )
    `
    return res.id as string
  } finally {
    await sql.end()
  }
}

/**
 * Mutates reservation status concurrently in the database to trigger N21 conflict error.
 */
async function mutateReservationStatus(
  reservationId: string,
  newStatus: 'reserved' | 'occupied',
) {
  const sql = getDb()
  try {
    const bookingToken = generateCrockfordToken()
    await sql`
      update public.reservations
      set status = ${newStatus},
          booking_token = ${bookingToken},
          wait_window_ends_at = now() + interval '30 minutes',
          updated_at = now()
      where id = ${reservationId}
    `
    const externalPaymentId = generatePaymentId()
    await sql`
      update public.payments
      set status = 'paid',
          external_payment_id = ${externalPaymentId},
          paid_at = now(),
          updated_at = now()
      where reservation_id = ${reservationId}
    `
  } finally {
    await sql.end()
  }
}

/**
 * Reads where a hold and its payment stand, for refusals that must leave both untouched.
 */
async function readHoldAndPayment(reservationId: string) {
  const sql = getDb()
  try {
    const [res] = await sql`
      select status from public.reservations where id = ${reservationId}
    `
    const [pay] = await sql`
      select status from public.payments where reservation_id = ${reservationId}
    `
    return {
      reservation: res?.status as string | undefined,
      payment: pay?.status as string | undefined,
    }
  } finally {
    await sql.end()
  }
}

/**
 * Reads the state the Host has set on a unit.
 */
async function readHostState(unitId: string) {
  const sql = getDb()
  try {
    const [unit] = await sql`
      select host_state from public.units where id = ${unitId}
    `
    return unit?.host_state as string | undefined
  } finally {
    await sql.end()
  }
}

/**
 * Waits for the occupancy page itself. Its loading placeholder is streamed first, and at
 * 200% text the placeholder is wider than a 360 px screen, so a layout check that runs
 * too early measures the placeholder.
 */
async function expectOccupancyPage(page: Page) {
  await expect(
    page.getByRole('heading', { level: 1, name: /Kapihan Study Hall Occupancy/i }),
  ).toBeVisible()
}

test.describe('Host live occupancy control journeys (STORY-12, TSK-12.7)', () => {
  test.beforeEach(async () => {
    await cleanupOccupancyState()
  })

  test.afterAll(async () => {
    await cleanupOccupancyState()
  })

  test('Anonymous visitor is redirected to /login with returnUrl', async ({ page }) => {
    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fhost%2Fspaces%2F.*%2Foccupancy/i)
  })

  test('Authenticated Seeker is redirected away to /seeker (D-032)', async ({ page }) => {
    await logInAs(page, 'seeker@example.test')
    await expect(page).toHaveURL(/\/seeker$/)

    // Seeker attempts direct navigation to Host occupancy page -> redirected to /seeker
    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(/\/seeker$/)
  })

  test('Authenticated Host who does not own the space gets 404 (Negative N13)', async ({
    page,
  }) => {
    await logInAs(page, 'host2@example.test')
    await expect(page).toHaveURL(/\/host$/)

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(
      page.getByRole('heading', { name: 'This page could not be found.' }),
    ).toBeVisible()
    await expect(page.getByText('Kapihan Study Hall Occupancy')).toHaveCount(0)
  })

  test('Host marks walk-in as Occupied and performs same-state re-vouch (Moves H2, D-051)', async ({
    page,
  }) => {
    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    await expect(
      page.getByRole('heading', { level: 1, name: /Kapihan Study Hall Occupancy/i }),
    ).toBeVisible()
    await expect(page.getByText('Back to Spaces')).toBeVisible()

    // 1. Select unit S1 (starts available)
    const s1SelectBtn = page.getByRole('button', {
      name: /Select S1 .* to manage occupancy/i,
    })
    await expect(s1SelectBtn).toBeVisible()
    await s1SelectBtn.click()

    // Selected Unit Control group appears (N1)
    const s1Controls = page.getByRole('group', { name: 'Occupancy controls for S1' })
    await expect(s1Controls).toBeVisible()

    const s1AvailableBtn = s1Controls.getByRole('button', {
      name: 'Mark S1 as Available',
    })
    const s1OccupiedBtn = s1Controls.getByRole('button', { name: 'Mark S1 as Occupied' })

    // Verify initial status
    await expect(s1AvailableBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(s1OccupiedBtn).toHaveAttribute('aria-pressed', 'false')

    // 2. Mark unit Occupied for a walk-in (Move H2)
    await s1OccupiedBtn.click()

    // No modal appears; unit immediately updates to Occupied
    await expect(s1OccupiedBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(s1AvailableBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(/Host-updated/i).first()).toBeVisible()

    // Assert in database that no row was created in public.reservations (S1)
    const sql = getDb()
    let initialHostUpdatedAt: string
    try {
      const resRows = await sql`
        select id from public.reservations
        where space_id = ${SPACE_ID} and unit_id = ${UNIT_S1_ID}
      `
      expect(resRows.length).toBe(0)

      const [unitRow] = await sql`
        select host_updated_at from public.units
        where space_id = ${SPACE_ID} and id = ${UNIT_S1_ID}
      `
      if (!unitRow) {
        throw new Error('Unit S1 not found in database')
      }
      initialHostUpdatedAt = unitRow.host_updated_at
    } finally {
      await sql.end()
    }

    // 3. Same-state tap on Host-set unit re-vouches freshness (Move H2, D-051)
    await s1OccupiedBtn.click()

    // No dialog opens; unit remains Occupied
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(s1OccupiedBtn).toHaveAttribute('aria-pressed', 'true')

    // Verify in database that host_updated_at was updated forward (S1)
    await expect
      .poll(async () => {
        const checkSql = getDb()
        try {
          const [updatedRow] = await checkSql`
            select host_updated_at from public.units
            where space_id = ${SPACE_ID} and id = ${UNIT_S1_ID}
          `
          if (!updatedRow) {
            throw new Error('Unit S1 not found during poll')
          }
          return new Date(updatedRow.host_updated_at).getTime()
        } finally {
          await checkSql.end()
        }
      })
      .toBeGreaterThan(new Date(initialHostUpdatedAt).getTime())

    // 4. Reset unit back to Available
    await s1AvailableBtn.click()
    await expect(s1AvailableBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(s1OccupiedBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('View mode toggling and accessible List View interaction with keyboard support (D-031)', async ({
    page,
  }) => {
    // Seed an active hold on S2 so it has an interactive confirmation dialog
    await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    const seatMapToggle = page.getByRole('button', { name: 'Seat Map View' })
    const listViewToggle = page.getByRole('button', { name: 'List View' })

    await expect(seatMapToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(listViewToggle).toHaveAttribute('aria-pressed', 'false')

    // Switch to List View
    await listViewToggle.click()
    await expect(listViewToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(seatMapToggle).toHaveAttribute('aria-pressed', 'false')

    // In List View, unit controls for S1 and S2 are present
    const s1ListControls = page
      .getByRole('group', { name: 'Occupancy controls for S1' })
      .filter({ visible: true })
    await expect(s1ListControls).toBeVisible()

    // Mark S1 Occupied directly from list view
    await s1ListControls.getByRole('button', { name: 'Mark S1 as Occupied' }).click()
    await expect(
      s1ListControls.getByRole('button', { name: 'Mark S1 as Occupied' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Restore S1 back to Available
    await s1ListControls.getByRole('button', { name: 'Mark S1 as Available' }).click()
    await expect(
      s1ListControls.getByRole('button', { name: 'Mark S1 as Available' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Keyboard navigation in List View (S3):
    // Focus the 'Mark S2 as Available' pill and trigger override confirmation via Enter key
    const s2AvailablePill = page
      .getByRole('group', { name: 'Occupancy controls for S2' })
      .filter({ visible: true })
      .getByRole('button', { name: 'Mark S2 as Available' })

    await s2AvailablePill.focus()
    await expect(s2AvailablePill).toBeFocused()
    await page.keyboard.press('Enter')

    // Dialog opens with initial focus on Cancel
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    const cancelButton = dialog.getByRole('button', { name: 'Cancel', exact: true })
    await expect(cancelButton).toBeFocused()

    // Press Escape to dismiss dialog; focus returns to the pill (S3)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(s2AvailablePill).toBeFocused()

    // Toggle back to Seat Map View
    await seatMapToggle.click()
    await expect(seatMapToggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('Override active hold warning dialog on pending, reserved, and occupied units (Moves R5, R9, R11, D-050)', async ({
    page,
  }) => {
    // 1. Seed active hold on S2 ('reserved', Move R9)
    const resIdS2 = await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    // ==========================================
    // 1. Unit S2: 'reserved' status (Move R9)
    // ==========================================
    const s2SelectBtn = page.getByRole('button', {
      name: /Select S2 .* to manage occupancy/i,
    })
    await s2SelectBtn.click()

    const s2Controls = page.getByRole('group', { name: 'Occupancy controls for S2' })
    await expect(s2Controls).toBeVisible()
    await expect(
      s2Controls.getByRole('button', { name: 'Mark S2 as Reserved' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Same-state tap on a Seeker-held unit is a no-op (S1):
    // verify no Server Action network mutation request is dispatched and no alert appears
    let postRequestCount = 0
    const requestListener = (req: { method: () => string }) => {
      if (req.method() === 'POST') {
        postRequestCount++
      }
    }
    page.on('request', requestListener)

    await s2Controls.getByRole('button', { name: 'Mark S2 as Reserved' }).click()
    await page.waitForTimeout(300)
    page.off('request', requestListener)

    expect(postRequestCount).toBe(0)
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    // Tap Available to trigger status-specific override warning dialog
    await s2Controls.getByRole('button', { name: 'Mark S2 as Available' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Override active hold?')).toBeVisible()
    await expect(dialog.getByText('Unit: S2')).toBeVisible()
    await expect(
      dialog.getByText(/The Seeker has already paid for this hold.*cancel their hold/i),
    ).toBeVisible()

    // Cancel dismisses without mutating
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      s2Controls.getByRole('button', { name: 'Mark S2 as Reserved' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Confirm override for reserved hold (Move R9)
    await s2Controls.getByRole('button', { name: 'Mark S2 as Available' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel hold and mark Available' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      s2Controls.getByRole('button', { name: 'Mark S2 as Available' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Database verification for R9: hold cancelled, payment paid (S2)
    const sql = getDb()
    try {
      const [resR9] = await sql`
        select status from public.reservations where id = ${resIdS2}
      `
      const [payR9] = await sql`
        select status from public.payments where reservation_id = ${resIdS2}
      `
      expect(resR9?.status).toBe('cancelled')
      expect(payR9?.status).toBe('paid')
    } finally {
      await sql.end()
    }

    // ==========================================
    // 2. Unit S1: 'pending_payment' status (Move R5)
    // ==========================================
    // Now that S2 hold is cancelled, seed hold on S1 (maintains 1 active hold per seeker constraint)
    const resIdS1 = await createTestReservation(UNIT_S1_ID, 'S1', 'pending_payment')
    await page.reload()

    const s1SelectBtn = page.getByRole('button', {
      name: /Select S1 .* to manage occupancy/i,
    })
    await s1SelectBtn.click()

    const s1Controls = page.getByRole('group', { name: 'Occupancy controls for S1' })
    await expect(s1Controls).toBeVisible()

    await s1Controls.getByRole('button', { name: 'Mark S1 as Available' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Override active hold?')).toBeVisible()
    await expect(dialog.getByText('Unit: S1')).toBeVisible()
    await expect(dialog.getByText(/unpaid hold.*cancel the Seeker's hold/i)).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel hold and mark Available' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      s1Controls.getByRole('button', { name: 'Mark S1 as Available' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Database verification for R5: hold cancelled, payment pending (S2)
    const sqlR5 = getDb()
    try {
      const [resR5] = await sqlR5`
        select status from public.reservations where id = ${resIdS1}
      `
      const [payR5] = await sqlR5`
        select status from public.payments where reservation_id = ${resIdS1}
      `
      expect(resR5?.status).toBe('cancelled')
      expect(payR5?.status).toBe('pending')
    } finally {
      await sqlR5.end()
    }

    // ==========================================
    // 3. Unit S3: 'occupied' status (Move R11)
    // ==========================================
    // Now that S1 hold is cancelled, seed occupied visit on S3
    const resIdS3 = await createTestReservation(UNIT_S3_ID, 'S3', 'occupied')
    await page.reload()

    const s3SelectBtn = page.getByRole('button', {
      name: /Select S3 .* to manage occupancy/i,
    })
    await s3SelectBtn.click()

    const s3Controls = page.getByRole('group', { name: 'Occupancy controls for S3' })
    await expect(s3Controls).toBeVisible()
    await expect(
      s3Controls.getByRole('button', { name: 'Mark S3 as Occupied' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await s3Controls.getByRole('button', { name: 'Mark S3 as Available' }).click()
    await expect(dialog).toBeVisible()
    // Occupied visit override uses the specific "End this visit?" title (R11)
    await expect(dialog.getByText('End this visit?')).toBeVisible()
    await expect(dialog.getByText('Unit: S3')).toBeVisible()
    await expect(
      dialog.getByText(/checked in at this unit.*end their visit/i),
    ).toBeVisible()

    await dialog.getByRole('button', { name: 'End visit and mark Available' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      s3Controls.getByRole('button', { name: 'Mark S3 as Available' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Database verification for R11: visit completed, payment paid (S2)
    const sqlR11 = getDb()
    try {
      const [resR11] = await sqlR11`
        select status from public.reservations where id = ${resIdS3}
      `
      const [payR11] = await sqlR11`
        select status from public.payments where reservation_id = ${resIdS3}
      `
      expect(resR11?.status).toBe('completed')
      expect(payR11?.status).toBe('paid')
    } finally {
      await sqlR11.end()
    }
  })

  test('Conflict alert with one-click refresh on concurrent hold modification (Negative N21)', async ({
    page,
  }) => {
    // Seed an unpaid hold on S3 (pending_payment)
    const resId = await createTestReservation(UNIT_S3_ID, 'S3', 'pending_payment')

    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    const s3Button = page.getByRole('button', {
      name: /Select S3 .* to manage occupancy/i,
    })
    await s3Button.click()

    const s3Controls = page.getByRole('group', { name: 'Occupancy controls for S3' })
    await expect(s3Controls).toBeVisible()

    // Host clicks Available to open confirmation dialog
    await s3Controls.getByRole('button', { name: 'Mark S3 as Available' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Simulate concurrent modification in database before Host confirms
    await mutateReservationStatus(resId, 'reserved')

    // Host confirms override based on stale pending_payment status
    const confirmButton = dialog.getByRole('button', {
      name: 'Cancel hold and mark Available',
    })
    await confirmButton.click()

    // Dialog closes and conflict alert banner appears with one-click refresh
    await expect(dialog).toHaveCount(0)
    const conflictAlert = page.getByRole('alert').filter({
      hasText: 'Hold status has changed. Please refresh.',
    })
    await expect(conflictAlert).toBeVisible()

    // The refused override left the hold as the Seeker has it: reserved and paid
    expect(await readHoldAndPayment(resId)).toEqual({
      reservation: 'reserved',
      payment: 'paid',
    })

    const refreshButton = conflictAlert.getByRole('button', { name: 'Refresh' })
    await expect(refreshButton).toBeVisible()
    await refreshButton.click()

    // Alert clears after refresh
    await expect(conflictAlert).toHaveCount(0)
  })

  test('Responsive viewports and 200% text scaling (360, 768, 1024 px, D-031)', async ({
    page,
  }) => {
    // Seed a hold on S2 to verify dialog on mobile viewport
    await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    // 1. Mobile viewport: 360 px width with 200% text scaling (#272, S1)
    await page.setViewportSize({ width: 360, height: 640 })
    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))
    await expectOccupancyPage(page)

    // Set root font size to 200% (S1)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })

    // Verify document does not horizontally overflow at 360 px / 200% font size
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(mobileOverflow).toBe(true)

    // Select S2 and open dialog at 360 px / 200% text
    const s2Button = page.getByRole('button', {
      name: /Select S2 .* to manage occupancy/i,
    })
    await s2Button.click()
    const s2Controls = page.getByRole('group', { name: 'Occupancy controls for S2' })
    await s2Controls.getByRole('button', { name: 'Mark S2 as Available' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Verify all four sides of dialog box remain within the 360x640 viewport (S1)
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    if (dialogBox) {
      expect(dialogBox.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox.y).toBeGreaterThanOrEqual(0)
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(360)
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(640)
    }

    // Dismiss dialog
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // Reset font size for standard viewport testing
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '100%'
    })

    // 2. Tablet viewport: 768 px width
    await page.setViewportSize({ width: 768, height: 1024 })
    const tabletOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(tabletOverflow).toBe(true)

    // 3. Desktop viewport: 1024 px width
    await page.setViewportSize({ width: 1024, height: 768 })
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(desktopOverflow).toBe(true)
  })

  // An Administrator may open the Host portal (D-032), but a Space's occupancy page is
  // its Host's alone, like the edit page (STORY-05 §1.3).
  test('Administrator gets the same not-found page', async ({ page }) => {
    await logInAs(page, 'admin@example.test', '/host')
    await expect(page).toHaveURL(/\/host$/)

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(
      page.getByRole('heading', { name: 'This page could not be found.' }),
    ).toBeVisible()
    await expect(page.getByText('Kapihan Study Hall Occupancy')).toHaveCount(0)
  })

  test('Hold made after the page loaded is refused, not overridden (Negative N14)', async ({
    page,
  }) => {
    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    // Select S3 while nobody holds it
    await page.getByRole('button', { name: /Select S3 .* to manage occupancy/i }).click()
    const s3Controls = page.getByRole('group', { name: 'Occupancy controls for S3' })
    await expect(
      s3Controls.getByRole('button', { name: 'Mark S3 as Available' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // A Seeker holds S3 while the Host's page still shows it free
    const resId = await createTestReservation(UNIT_S3_ID, 'S3', 'pending_payment')

    // The page knows of no hold, so it opens no dialog. The tap names no hold, and the
    // database refuses it.
    await s3Controls.getByRole('button', { name: 'Mark S3 as Occupied' }).click()
    const refusal = page.getByRole('main').getByRole('alert')
    await expect(refusal).toContainText(
      'A Seeker has just held this unit. Please review the hold.',
    )
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    // The Seeker's hold and the unit are as they were
    expect(await readHoldAndPayment(resId)).toEqual({
      reservation: 'pending_payment',
      payment: 'pending',
    })
    expect(await readHostState(UNIT_S3_ID)).toBe('available')

    // One-click Refresh clears the alert and shows the hold
    await refusal.getByRole('button', { name: 'Refresh' }).click()
    await expect(refusal).toHaveCount(0)
    const selectedUnit = page.getByRole('complementary', {
      name: 'Selected unit control',
    })
    await expect(selectedUnit.getByText('Seeker hold')).toBeVisible()
    await expect(selectedUnit.getByText('Pending Payment')).toBeVisible()
  })

  // The Sprint 2 Definition of Done's seat map parity: what the map can do, the list view
  // can do by keyboard alone.
  test('List View marks a walk-in by keyboard alone (Tab, Enter and Space)', async ({
    page,
  }) => {
    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    const listViewToggle = page.getByRole('button', { name: 'List View' })
    await listViewToggle.focus()
    await page.keyboard.press('Enter')
    await expect(listViewToggle).toHaveAttribute('aria-pressed', 'true')

    const s1Available = page.getByRole('button', { name: 'Mark S1 as Available' })
    const s1Reserved = page.getByRole('button', { name: 'Mark S1 as Reserved' })
    const s1Occupied = page.getByRole('button', { name: 'Mark S1 as Occupied' })

    // Tab walks from the toggle into the list: S1 is the first unit, and its three pills
    // come in order. Nothing has to be selected first.
    await page.keyboard.press('Tab')
    await expect(s1Available).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(s1Reserved).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(s1Occupied).toBeFocused()

    // Enter marks the walk-in. The pill stays focusable while it saves, so the Host
    // keeps their place (D-031).
    await page.keyboard.press('Enter')
    await expect(s1Occupied).toHaveAttribute('aria-pressed', 'true')
    await expect(s1Occupied).toBeFocused()
    expect(await readHostState(UNIT_S1_ID)).toBe('occupied')

    // Shift+Tab goes back, and Space works as well as Enter
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(s1Available).toBeFocused()
    await page.keyboard.press('Space')
    await expect(s1Available).toHaveAttribute('aria-pressed', 'true')
    expect(await readHostState(UNIT_S1_ID)).toBe('available')
  })

  test('Override dialog keeps Tab and Shift+Tab inside it (design §3, focus trap)', async ({
    page,
  }) => {
    const resId = await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))
    await page.getByRole('button', { name: 'List View' }).click()

    // Open the dialog from the keyboard
    const s2AvailablePill = page.getByRole('button', { name: 'Mark S2 as Available' })
    await s2AvailablePill.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('alertdialog')
    const cancelButton = dialog.getByRole('button', { name: 'Cancel', exact: true })
    const confirmButton = dialog.getByRole('button', {
      name: 'Cancel hold and mark Available',
    })
    await expect(cancelButton).toBeFocused()

    // Tab and Shift+Tab move between the dialog's two buttons and never reach the page
    await page.keyboard.press('Tab')
    await expect(confirmButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancelButton).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(confirmButton).toBeFocused()

    // Escape changes nothing
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(await readHoldAndPayment(resId)).toEqual({
      reservation: 'reserved',
      payment: 'paid',
    })
  })

  test('200% text at 768 and 1024 px: no sideways scroll, and the dialog stays on screen (D-031)', async ({
    page,
  }) => {
    // Seed a hold on S2, so the dialog can be opened at each size
    await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    await logInAs(page, 'host@example.test', `/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(new RegExp(`/host/spaces/${SPACE_ID}/occupancy$`))

    const viewports = [
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]
    for (const viewport of viewports) {
      const where = `${viewport.width} px with text at 200%`
      await page.setViewportSize(viewport)
      await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
      await expectOccupancyPage(page)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })

      // Neither view scrolls sideways
      const seatMapFits = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      )
      expect(seatMapFits, `seat map view at ${where}`).toBe(true)

      await page.getByRole('button', { name: 'List View' }).click()
      const s2AvailablePill = page.getByRole('button', { name: 'Mark S2 as Available' })
      await expect(s2AvailablePill).toBeVisible()
      const listFits = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      )
      expect(listFits, `list view at ${where}`).toBe(true)

      // The dialog sits inside the screen on all four sides
      await s2AvailablePill.click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      const dialogBox = await dialog.boundingBox()
      expect(dialogBox, `dialog at ${where}`).not.toBeNull()
      if (dialogBox) {
        expect(dialogBox.x, `dialog's left edge at ${where}`).toBeGreaterThanOrEqual(0)
        expect(dialogBox.y, `dialog's top edge at ${where}`).toBeGreaterThanOrEqual(0)
        expect(
          dialogBox.x + dialogBox.width,
          `dialog's right edge at ${where}`,
        ).toBeLessThanOrEqual(viewport.width)
        expect(
          dialogBox.y + dialogBox.height,
          `dialog's bottom edge at ${where}`,
        ).toBeLessThanOrEqual(viewport.height)
      }

      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    }
  })
})
