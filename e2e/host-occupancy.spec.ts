import { expect, test } from '@playwright/test'
import postgres from 'postgres'

// The shared seed password for all local test accounts (supabase/seed.sql).
// Local and CI only (D-013). Never used against the cloud dev project (D-028).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Seeded test IDs (supabase/seed.sql)
const SPACE_ID = 'e0000000-0000-4000-8000-000000000001' // Kapihan Study Hall (verified, host@)
const OTHER_HOST_SPACE_ID = 'e0000000-0000-4000-8000-000000000003' // Sulok Co-working (host2@)

const UNIT_S1_ID = 'f0000000-0000-4000-8000-000000000001'
const UNIT_S2_ID = 'f0000000-0000-4000-8000-000000000002'
const UNIT_S3_ID = 'f0000000-0000-4000-8000-000000000003'
const SEEKER_1_ID = 'c0000000-0000-4000-8000-000000000001' // Sam Dela Cruz

function getDb() {
  return postgres(databaseUrl, { max: 1 })
}

/**
 * Resets reservations and host unit states for S1-S3 back to initial seed state.
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
 * Seeds a test reservation with cascading payment for testing override and conflict flows.
 */
async function createTestReservation(
  unitId: string,
  unitLabel: string,
  status: 'pending_payment' | 'reserved' | 'occupied',
) {
  const sql = getDb()
  try {
    const [res] = await sql`
      insert into public.reservations (
        seeker_id,
        space_id,
        unit_id,
        unit_label,
        status,
        wait_window,
        payment_window_ends_at,
        wait_window_ends_at
      ) values (
        ${SEEKER_1_ID},
        ${SPACE_ID},
        ${unitId},
        ${unitLabel},
        ${status},
        interval '30 minutes',
        now() + interval '15 minutes',
        ${status !== 'pending_payment' ? sql`now() + interval '30 minutes'` : null}
      )
      returning id
    `
    if (!res?.id) {
      throw new Error('Failed to insert test reservation')
    }
    await sql`
      insert into public.payments (
        reservation_id,
        status,
        fee_amount,
        paid_at
      ) values (
        ${res.id},
        ${status === 'pending_payment' ? 'pending' : 'paid'},
        50,
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
    await sql`
      update public.reservations
      set status = ${newStatus}, updated_at = now()
      where id = ${reservationId}
    `
  } finally {
    await sql.end()
  }
}

test.describe('Host live occupancy control journeys (STORY-12, TSK-12.7)', () => {
  test.beforeEach(async () => {
    await cleanupOccupancyState()
  })

  test.afterAll(async () => {
    await cleanupOccupancyState()
  })

  test('Access control and role isolation (D-032, Negative N13, N24)', async ({
    page,
  }) => {
    // 1. Anonymous visitor is redirected to /login with returnUrl
    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fhost$/)

    // 2. Authenticated Seeker is redirected away to /seeker
    await page.getByLabel('Email').fill('seeker@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/seeker$/)

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(page).toHaveURL(/\/seeker$/)

    // 3. Authenticated Host cannot view another Host's space occupancy (N13: 404 notFound)
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const response = await page.goto(`/host/spaces/${OTHER_HOST_SPACE_ID}/occupancy`)
    expect(response?.status()).toBe(404)
  })

  test('Host marks walk-in as Occupied and performs same-state re-vouch (Moves H2, D-051)', async ({
    page,
  }) => {
    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)
    await expect(
      page.getByRole('heading', { level: 1, name: /Kapihan Study Hall Occupancy/i }),
    ).toBeVisible()
    await expect(page.getByText('Back to Spaces')).toBeVisible()

    // 1. Select unit S1 (starts available)
    const s1Button = page.getByRole('button', {
      name: /Select S1 .* to manage occupancy/i,
    })
    await expect(s1Button).toBeVisible()
    await s1Button.click()

    // Selected Unit Control card appears
    const controlCard = page.locator('div[data-slot="card"]').filter({
      has: page.getByLabel('Occupancy controls for S1'),
    })
    await expect(controlCard).toBeVisible()
    await expect(controlCard.getByText('Available')).toBeVisible()

    // 2. Mark unit Occupied for a walk-in (Move H2)
    const occupancyControls = controlCard.getByLabel('Occupancy controls for S1')
    await occupancyControls.getByRole('button', { name: 'Mark S1 as Occupied' }).click()

    // No modal appears; unit immediately updates to Occupied
    await expect(controlCard.getByText('Occupied')).toBeVisible()
    await expect(controlCard.getByText(/Host-updated/i)).toBeVisible()

    // 3. Same-state tap on Host-set unit re-vouches freshness (Move H2, D-051)
    await occupancyControls.getByRole('button', { name: 'Mark S1 as Occupied' }).click()
    // No dialog opens
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(controlCard.getByText('Occupied')).toBeVisible()

    // 4. Reset unit back to Available
    await occupancyControls.getByRole('button', { name: 'Mark S1 as Available' }).click()
    await expect(controlCard.getByText('Available')).toBeVisible()
  })

  test('View mode toggling and accessible List View interaction', async ({ page }) => {
    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)

    const seatMapToggle = page.getByRole('button', { name: 'Seat Map View' })
    const listViewToggle = page.getByRole('button', { name: 'List View' })

    await expect(seatMapToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(listViewToggle).toHaveAttribute('aria-pressed', 'false')

    // Switch to List View
    await listViewToggle.click()
    await expect(listViewToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(seatMapToggle).toHaveAttribute('aria-pressed', 'false')

    // In List View, unit controls for S1 are present in the table/list
    const s1RowControls = page
      .getByLabel('Occupancy controls for S1')
      .filter({ visible: true })
    await expect(s1RowControls).toBeVisible()

    // Mark unit Occupied directly from list view
    await s1RowControls.getByRole('button', { name: 'Mark S1 as Occupied' }).click()
    await expect(page.getByText('Occupied').first()).toBeVisible()

    // Restore back to Available
    await s1RowControls.getByRole('button', { name: 'Mark S1 as Available' }).click()
    await expect(page.getByText('Available').first()).toBeVisible()

    // Toggle back to Seat Map View
    await seatMapToggle.click()
    await expect(seatMapToggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('Override active hold warning dialog (Moves R5, R9, D-050)', async ({ page }) => {
    // Seed an active paid reservation on S2 (reserved)
    await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)

    // Select S2 (which is currently held by a Seeker)
    const s2Button = page.getByRole('button', {
      name: /Select S2 .* to manage occupancy/i,
    })
    await s2Button.click()

    const controlCard = page.locator('div[data-slot="card"]').filter({
      has: page.getByLabel('Occupancy controls for S2'),
    })
    await expect(controlCard.getByText('Reserved')).toBeVisible()

    const s2Controls = controlCard.getByLabel('Occupancy controls for S2')

    // 1. Same-state tap on a Seeker-held unit is a no-op (no modal, no mutation)
    await s2Controls.getByRole('button', { name: 'Mark S2 as Reserved' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    // 2. Different-state tap opens the status-specific override warning dialog
    await s2Controls.getByRole('button', { name: 'Mark S2 as Available' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Override active hold?')).toBeVisible()
    await expect(dialog.getByText('Unit: S2')).toBeVisible()
    await expect(
      dialog.getByText(/The Seeker has already paid for this hold.*cancel their hold/i),
    ).toBeVisible()

    // 3. Cancel button dismisses the dialog without mutating the hold
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' })
    await cancelButton.click()
    await expect(dialog).toHaveCount(0)
    await expect(controlCard.getByText('Reserved')).toBeVisible()

    // 4. Re-open dialog and confirm override (Move R9)
    await s2Controls.getByRole('button', { name: 'Mark S2 as Available' }).click()
    await expect(dialog).toBeVisible()

    const confirmButton = dialog.getByRole('button', {
      name: 'Cancel hold and mark Available',
    })
    await expect(confirmButton).toBeVisible()
    await confirmButton.click()

    // Dialog closes and unit state transitions to Available
    await expect(dialog).toHaveCount(0)
    await expect(controlCard.getByText('Available')).toBeVisible()
  })

  test('Conflict alert with one-click refresh on concurrent hold modification (Negative N21)', async ({
    page,
  }) => {
    // Seed an unpaid hold on S3 (pending_payment)
    const resId = await createTestReservation(UNIT_S3_ID, 'S3', 'pending_payment')

    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)

    const s3Button = page.getByRole('button', {
      name: /Select S3 .* to manage occupancy/i,
    })
    await s3Button.click()

    const controlCard = page.locator('div[data-slot="card"]').filter({
      has: page.getByLabel('Occupancy controls for S3'),
    })
    const s3Controls = controlCard.getByLabel('Occupancy controls for S3')

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

    const refreshButton = conflictAlert.getByRole('button', { name: 'Refresh' })
    await expect(refreshButton).toBeVisible()
    await refreshButton.click()

    // Alert clears after refresh
    await expect(conflictAlert).toHaveCount(0)
  })

  test('Responsive viewports and keyboard navigation (360, 768, 1024 px, D-031)', async ({
    page,
  }) => {
    // Seed a hold on S2 to verify dialog on mobile viewport
    await createTestReservation(UNIT_S2_ID, 'S2', 'reserved')

    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    // 1. Mobile viewport: 360 px width
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto(`/host/spaces/${SPACE_ID}/occupancy`)

    // Verify document does not horizontally overflow
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(mobileOverflow).toBe(true)

    // Select S2 and open dialog at 360 px
    const s2Button = page.getByRole('button', {
      name: /Select S2 .* to manage occupancy/i,
    })
    await s2Button.click()
    const controlCard = page.locator('div[data-slot="card"]').filter({
      has: page.getByLabel('Occupancy controls for S2'),
    })
    await controlCard
      .getByLabel('Occupancy controls for S2')
      .getByRole('button', { name: 'Mark S2 as Available' })
      .click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Check dialog fits within viewport
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox?.width).toBeLessThanOrEqual(360)

    // Keyboard navigation: Escape closes dialog and returns focus
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

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
})
