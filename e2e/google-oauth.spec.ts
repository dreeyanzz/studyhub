import { expect, test } from '@playwright/test'
import postgres from 'postgres'

/**
 * End-to-end Google OAuth onboarding, callback error handling, and route-guard
 * journey against the local Supabase stack (STORY-21, TSK-21.4, D-095).
 *
 * Uses synthetic `@example.test` accounts inserted into local `auth.users` with
 * `raw_app_meta_data.provider = 'google'` so `private.handle_new_user()` creates
 * real `role_confirmed = false` profiles without needing live Google credentials
 * in CI.
 */

const SEED_PASSWORD = 'Worq-demo-2026'
const DATABASE_URL =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const VERIFIED_SPACE_ID = 'e0000000-0000-4000-8000-000000000001'
const VERIFIED_UNIT_ID = 'f0000000-0000-4000-8000-000000000001'

const OAUTH_HOST_ID = 'd3000000-0000-4000-8000-000000000001'
const OAUTH_SEEKER_ID = 'd3000000-0000-4000-8000-000000000002'
const OAUTH_SIGNOUT_ID = 'd3000000-0000-4000-8000-000000000003'
const ALL_FIXTURE_IDS = [OAUTH_HOST_ID, OAUTH_SEEKER_ID, OAUTH_SIGNOUT_ID]

function db() {
  return postgres(DATABASE_URL, { max: 1 })
}

async function cleanupFixtureUsers() {
  const sql = db()
  try {
    await sql`delete from auth.users where id = any(${ALL_FIXTURE_IDS}::uuid[])`
  } finally {
    await sql.end()
  }
}

async function seedUnconfirmedGoogleUser(id: string, email: string, fullName: string) {
  const sql = db()
  try {
    await sql`delete from auth.users where id = ${id}::uuid`
    // Inserting with provider = 'google' triggers private.handle_new_user() to create
    // a profiles row with role = 'seeker' and role_confirmed = false (D-095).
    await sql`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000',
        ${id}::uuid,
        'authenticated',
        'authenticated',
        ${email},
        extensions.crypt(${SEED_PASSWORD}, extensions.gen_salt('bf')),
        now(),
        '{"provider": "google", "providers": ["google", "email"]}'::jsonb,
        jsonb_build_object('full_name', ${fullName}::text),
        now(),
        now(),
        '', '', '', ''
      )
    `
    await sql`
      insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        ${id}::uuid,
        ${id}::text,
        'email',
        jsonb_build_object('sub', ${id}::text, 'email', ${email}::text, 'email_verified', true),
        now(),
        now(),
        now()
      )
    `
  } finally {
    await sql.end()
  }
}

test.describe('Google OAuth onboarding and callback journey (STORY-21, D-095)', () => {
  test.beforeEach(async () => {
    await cleanupFixtureUsers()
  })

  test.afterAll(async () => {
    await cleanupFixtureUsers()
  })

  test('renders Continue with Google and handles callback OAuth errors safely (G2, G3, O-N8, O-N9)', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    // Cancelled Google consent from /register?role=host preserves source, role and returnUrl (G2).
    const back = `/spaces/${VERIFIED_SPACE_ID}`
    await page.goto(
      `/api/auth/callback?error=access_denied&source=/register&role=host&returnUrl=${encodeURIComponent(back)}`,
    )
    await expect(page).toHaveURL(
      new RegExp(`/register\\?error=oauth-cancelled&returnUrl=.*&role=host$`),
    )
    await expect(page.getByText('Google sign-in was cancelled.')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Host' })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    // Tampered source, open-redirect returnUrl and role=admin are dropped (O-N8, O-N9).
    await page.goto(
      '/api/auth/callback?error=server_error&source=/evil&returnUrl=//evil.example&role=admin',
    )
    await expect(page).toHaveURL(/\/login\?error=oauth$/)
    await expect(page.getByText('We could not sign you in with Google.')).toBeVisible()
  })

  test('blocks portals until role confirmation, then confirms Host and locks /choose-role (G7, G9, G11, G12, G13)', async ({
    page,
  }) => {
    const email = 'oauth-host-e2e@example.test'
    await seedUnconfirmedGoogleUser(OAUTH_HOST_ID, email, 'Marco E2E')

    // Signing in with an unconfirmed profile lands straight on /choose-role.
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/choose-role$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Finish setting up your account' }),
    ).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
    await expect(page.getByLabel('Full name')).toHaveValue('Marco E2E')

    // Portals redirect back to /choose-role with returnUrl (G11).
    await page.goto('/seeker')
    await expect(page).toHaveURL(/\/choose-role\?returnUrl=%2Fseeker$/)
    await page.goto('/host')
    await expect(page).toHaveURL(/\/choose-role\?returnUrl=%2Fhost$/)

    // Space profile Hold panel does not treat an unconfirmed account as a confirmed Seeker (G12).
    await page.goto(`/spaces/${VERIFIED_SPACE_ID}?unit=${VERIFIED_UNIT_ID}`)
    await expect(page.getByRole('button', { name: /Hold & Pay/i })).toHaveCount(0)

    // /register?role=host forwards to /choose-role?role=host with Host preselected (G11, G9).
    await page.goto('/register?role=host')
    await expect(page).toHaveURL(/\/choose-role\?role=host$/)
    await expect(page.getByRole('radio', { name: 'Host' })).toBeChecked()

    // Edit Full name and confirm Host once (G7).
    await page.getByLabel('Full name').fill('Marco Santos')
    await page.getByRole('button', { name: 'Continue to Worq' }).click()

    await expect(page).toHaveURL(/\/host$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Manage Spaces' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Space' })).toBeVisible()

    // Revisiting /choose-role once confirmed redirects straight back to /host (G13).
    await page.goto('/choose-role')
    await expect(page).toHaveURL(/\/host$/)
  })

  test('preserves returnUrl back to Space profile after confirming Seeker (G7, G9, D-058)', async ({
    page,
  }) => {
    const email = 'oauth-seeker-e2e@example.test'
    await seedUnconfirmedGoogleUser(OAUTH_SEEKER_ID, email, 'Gina E2E')

    const back = `/spaces/${VERIFIED_SPACE_ID}`
    await page.goto(`/login?returnUrl=${encodeURIComponent(back)}`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(
      new RegExp(`/choose-role\\?returnUrl=${encodeURIComponent(back)}$`),
    )
    await page.getByRole('radio', { name: 'Seeker' }).check()
    await page.getByRole('button', { name: 'Continue to Worq' }).click()

    await expect(page).toHaveURL(new RegExp(`${back}$`))

    await page.goto('/seeker')
    await expect(page).toHaveURL(/\/seeker$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seeker Dashboard' }),
    ).toBeVisible()
  })

  test('allows an unconfirmed OAuth user to sign out from /choose-role (G10, G13)', async ({
    page,
  }) => {
    const email = 'oauth-signout-e2e@example.test'
    await seedUnconfirmedGoogleUser(OAUTH_SIGNOUT_ID, email, 'Switch Account')

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/choose-role$/)
    await page
      .getByRole('button', { name: 'Log out and use a different account' })
      .click()

    await expect(page).toHaveURL(/\/$/)

    // Signed-out visitor attempting /choose-role is sent to /login (G13).
    await page.goto('/choose-role')
    await expect(page).toHaveURL(/\/login$/)
  })
})
