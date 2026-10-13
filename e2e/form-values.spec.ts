import { expect, test, type Page } from '@playwright/test'

// The shared seed password for all local test accounts (supabase/seed.sql).
// Local and CI only (D-013). Never used against the cloud dev project (D-028).
const SEED_PASSWORD = 'Worq-demo-2026'

// What Base UI logs in development when an input's default value changes after it
// mounted, as these forms' inputs did after a failed save (#146).
const BASE_UI_WARNING = 'changing the default value state'

// Collects the page's console errors from now on.
function collectConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

// Base UI's check runs in an effect, which React runs just after the browser paints,
// so wait two frames before checking that nothing was logged.
async function afterEffects(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
}

test.describe('A failed save keeps what was typed (#146)', () => {
  test('Log in with a wrong password', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/login')

    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password').fill('Wrong-pass-123')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('host@example.test')
    // A password is never put back.
    await expect(page.getByLabel('Password')).toHaveValue('')
    await afterEffects(page)
    expect(errors.filter((error) => error.includes(BASE_UI_WARNING))).toEqual([])
  })

  test('Sign up with an email that already has an account', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/register')

    await page.getByRole('radio', { name: 'Host', exact: true }).check()
    await page.getByLabel('Full name').fill('Rosa Example')
    await page.getByLabel('Email').fill('host@example.test')
    await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
    await page.getByLabel('Confirm password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(
      page.getByText('An account with this email already exists.'),
    ).toBeVisible()
    await expect(page.getByLabel('Full name')).toHaveValue('Rosa Example')
    await expect(page.getByLabel('Email')).toHaveValue('host@example.test')
    await expect(page.getByRole('radio', { name: 'Host', exact: true })).toBeChecked()
    await afterEffects(page)
    expect(errors.filter((error) => error.includes(BASE_UI_WARNING))).toEqual([])
  })

  test('Save a Space that was deleted in another tab', async ({ page, context }) => {
    const errors = collectConsoleErrors(page)
    // host2, so the Space this test makes never shows in host@'s list.
    await page.goto('/login')
    await page.getByLabel('Email').fill('host2@example.test')
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/host$/)

    const name = `Form values test ${Date.now()}`
    await page.getByLabel('Space name').fill(name)
    await page.getByLabel('Address').fill('12 Example Street')
    await page.getByLabel('Opening time').fill('08:00')
    await page.getByLabel('Closing time').fill('20:00')
    await page.getByRole('button', { name: 'Create Space' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    // A successful create starts the form over.
    await expect(page.getByLabel('Space name')).toHaveValue('')

    // Open the edit form, then delete the Space in a second tab.
    await page.getByRole('link', { name: `Edit ${name}` }).click()
    await expect(page).toHaveURL(/\/edit$/)
    const otherTab = await context.newPage()
    await otherTab.goto(page.url().replace(/\/edit$/, '/delete'))
    await otherTab.getByRole('button', { name: 'Delete Space' }).click()
    await expect(otherTab).toHaveURL(/notice=deleted/)

    await page.getByLabel('Space name').fill(`${name} renamed`)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('We could not save this Space.')).toBeVisible()
    await expect(page.getByLabel('Space name')).toHaveValue(`${name} renamed`)
    await expect(page.getByLabel('Address')).toHaveValue('12 Example Street')
    await afterEffects(page)
    expect(errors.filter((error) => error.includes(BASE_UI_WARNING))).toEqual([])
  })
})
