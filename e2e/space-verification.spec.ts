import { expect, test } from '@playwright/test'
import postgres from 'postgres'

// The shared seed password for all local test accounts (supabase/seed.sql).
// Local and CI only (D-013). Never used against the cloud dev project (D-028).
const SEED_PASSWORD = 'Worq-demo-2026'

const databaseUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// host@example.test (supabase/seed.sql), who creates this test's Spaces.
const HOST_1_ID = 'b0000000-0000-4000-8000-000000000001'

/**
 * Deletes the Spaces this test creates. Left behind, they piled up on the local stack
 * and broke the Space counts in supabase/tests/02-spaces.sql.
 */
async function deleteTestSpaces() {
  const sql = postgres(databaseUrl, { max: 1 })
  try {
    await sql`
      delete from public.spaces
      where host_id = ${HOST_1_ID}
        and name ~ '^(Approval|Rejection) Space [0-9]+$'
    `
  } finally {
    await sql.end()
  }
}

test.describe('Space verification portal (STORY-15)', () => {
  test.afterAll(deleteTestSpaces)

  test('Approve and Reject stay on screen at 360 px with 200% text (D-031)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    await page.goto('/login?returnUrl=%2Fadmin')
    await page.getByLabel('Email').fill('admin@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL('/admin')
    // The seed's Pending Space gives the queue at least one card.
    await expect(page.getByRole('button', { name: /^Reject / }).first()).toBeVisible()

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await page.waitForTimeout(700)

    const outside = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      return Array.from(document.querySelectorAll('main button'))
        .map((button) => ({
          name: button.textContent?.trim(),
          box: button.getBoundingClientRect(),
        }))
        .filter(
          ({ box }) => box.width > 0 && (box.left < -0.5 || box.right > width + 0.5),
        )
        .map(
          ({ name, box }) =>
            `${name}: ${Math.round(box.left)} to ${Math.round(box.right)}`,
        )
    })
    expect(outside).toEqual([])
  })

  test('Anonymous visitor is redirected to /login with returnUrl', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fadmin$/)
  })

  test('Authenticated Seeker is redirected away from /admin to /seeker (D-032)', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('seeker@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/seeker$/)

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/seeker$/)
  })

  test('Authenticated Host is redirected away from /admin to /host (D-032)', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/host$/)
  })

  test('Authenticated Administrator accesses /admin and verifies pending spaces', async ({
    page,
  }) => {
    // 1. Host creates a new Space to guarantee an isolated pending space for approval
    await page.goto('/login')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const uniqueApprovedName = `Approval Space ${Date.now()}`
    await page.getByLabel('Space name').fill(uniqueApprovedName)
    await page.getByLabel('Address').fill('100 Test St, Cebu City')
    await page.getByLabel('Opening time').fill('08:00')
    await page.getByLabel('Closing time').fill('20:00')
    await page.getByRole('button', { name: 'Create Space' }).click()
    await expect(
      page.getByText('Space created. It is pending verification.'),
    ).toBeVisible()

    // Host creates a second Space for rejection testing
    const uniqueRejectedName = `Rejection Space ${Date.now()}`
    await page.getByLabel('Space name').fill(uniqueRejectedName)
    await page.getByLabel('Address').fill('101 Test St, Cebu City')
    await page.getByLabel('Opening time').fill('09:00')
    await page.getByLabel('Closing time').fill('18:00')
    await page.getByRole('button', { name: 'Create Space' }).click()
    await expect(
      page.getByText('Space created. It is pending verification.'),
    ).toBeVisible()

    // Host logs out before Administrator signs in
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/')

    // 2. Administrator signs in and visits /admin
    await page.goto('/login?returnUrl=%2Fadmin')
    await page.getByLabel('Email').fill('admin@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Space Verification' }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Review pending Spaces. Approved Spaces become immediately visible in public search.',
      ),
    ).toBeVisible()

    // Verify presence of created spaces in the queue
    await expect(
      page.getByRole('heading', { level: 2, name: uniqueApprovedName }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 2, name: uniqueRejectedName }),
    ).toBeVisible()

    // 3. Administrator approves the first space (Move V2)
    const approveCard = page.locator('article, .rounded-lg, [data-slot="card"]').filter({
      has: page.getByRole('heading', { level: 2, name: uniqueApprovedName }),
    })
    await approveCard
      .getByRole('button', { name: new RegExp(`Approve ${uniqueApprovedName}`) })
      .click()

    // Status alert announces success (role="status", aria-live="polite")
    const successAlert = page.getByRole('status')
    await expect(successAlert).toContainText(`${uniqueApprovedName} has been approved.`)
    await expect(
      page.getByRole('heading', { level: 2, name: uniqueApprovedName }),
    ).toHaveCount(0)

    // 4. Administrator rejects the second space (Move V3)
    const rejectCard = page.locator('article, .rounded-lg, [data-slot="card"]').filter({
      has: page.getByRole('heading', { level: 2, name: uniqueRejectedName }),
    })
    await rejectCard
      .getByRole('button', { name: new RegExp(`Reject ${uniqueRejectedName}`) })
      .click()

    await expect(page.getByRole('status')).toContainText(
      `${uniqueRejectedName} has been rejected.`,
    )
    await expect(
      page.getByRole('heading', { level: 2, name: uniqueRejectedName }),
    ).toHaveCount(0)

    // 5. Host signs back in and verifies status in Host portal
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/login?returnUrl=%2Fhost')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const hostApprovedCard = page
      .locator('article, .rounded-lg, [data-slot="card"]')
      .filter({
        has: page.getByRole('heading', { level: 3, name: uniqueApprovedName }),
      })
    await expect(hostApprovedCard.getByText('Verified', { exact: true })).toBeVisible()

    // Host portal reflects Rejected status for rejected space
    const hostRejectedCard = page
      .locator('article, .rounded-lg, [data-slot="card"]')
      .filter({
        has: page.getByRole('heading', { level: 3, name: uniqueRejectedName }),
      })
    await expect(hostRejectedCard.getByText('Rejected', { exact: true })).toBeVisible()
  })
})
