import { expect, test } from '@playwright/test'

// The shared seed password for all local test accounts (supabase/seed.sql).
// Local and CI only (D-013). Never used against the cloud dev project (D-028).
const SEED_PASSWORD = 'Worq-demo-2026'

test.describe('Sign-in smoke test (STORY-06)', () => {
  test('Seeker signs in and lands on Seeker Dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('seeker@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/seeker$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seeker Dashboard' }),
    ).toBeVisible()
  })

  test('Host signs in and lands on Manage Spaces', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/host$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Manage Spaces' }),
    ).toBeVisible()
  })

  test('Administrator signs in and audits Host and Seeker portals (D-032)', async ({
    page,
  }) => {
    // Administrator signs in from /login?returnUrl=%2Fhost because there is no /admin
    // page until STORY-14 (STORY-06 design §4).
    await page.goto('/login?returnUrl=%2Fhost')

    await page.getByLabel('Email').fill('admin@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/host$/)
    await expect(page.getByText('Administrator')).toBeVisible()

    // As that Administrator, open /seeker to verify portal audit access (D-032)
    await page.goto('/seeker')
    await expect(page).toHaveURL(/\/seeker$/)
    await expect(page.getByText('Administrator')).toBeVisible()
  })
})
