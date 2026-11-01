// Registers the shared test accounts in the cloud dev project (D-028, D-061).
// Standard accounts sign up through Supabase Auth, the same path /register uses,
// so the sign-up trigger gives each its role. The Administrator account signs up
// as a seeker and is promoted to admin using the secret key (D-061). Safe to
// re-run: accounts that already exist are signed in instead, and every account's
// role and password are confirmed either way.
//
// Database owner only. Reads NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, CLOUD_DEV_ACCOUNT_PASSWORD,
// CLOUD_DEV_ADMIN_PASSWORD, and SUPABASE_SECRET_KEY:
//   npm run db:accounts      with the values in .env.local
import { createClient } from '@supabase/supabase-js'

// The same invented people as supabase/seed.sql.
const standardAccounts = [
  { email: 'host@example.test', role: 'host', fullName: 'Hugo Santos' },
  { email: 'host2@example.test', role: 'host', fullName: 'Hana Villanueva' },
  { email: 'seeker@example.test', role: 'seeker', fullName: 'Sam Dela Cruz' },
]

const adminAccount = {
  email: 'admin@example.test',
  role: 'admin',
  fullName: 'Alma Reyes',
}

// supabase/seed.sql publishes this password, and the repository is public.
const seedPassword = 'Worq-demo-2026'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const password = process.env.CLOUD_DEV_ACCOUNT_PASSWORD
const adminPassword = process.env.CLOUD_DEV_ADMIN_PASSWORD
const secretKey = process.env.SUPABASE_SECRET_KEY

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!url || !publishableKey) {
  fail('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.')
}
if (!password) {
  fail('CLOUD_DEV_ACCOUNT_PASSWORD must be set. See docs/DEVELOPMENT.md.')
}
if (password === seedPassword) {
  fail('CLOUD_DEV_ACCOUNT_PASSWORD must not be the public seed password (D-028).')
}
// STORY-03's password rules: at least 8 characters, with a number and a symbol.
if (password.length < 8 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  fail('CLOUD_DEV_ACCOUNT_PASSWORD needs at least 8 characters, a number and a symbol.')
}

if (!adminPassword) {
  fail('CLOUD_DEV_ADMIN_PASSWORD must be set. See docs/DEVELOPMENT.md.')
}
if (adminPassword === seedPassword) {
  fail('CLOUD_DEV_ADMIN_PASSWORD must not be the public seed password (D-028, D-061).')
}
if (adminPassword === password) {
  fail('CLOUD_DEV_ADMIN_PASSWORD must not match CLOUD_DEV_ACCOUNT_PASSWORD (D-061).')
}
if (
  adminPassword.length < 8 ||
  !/\d/.test(adminPassword) ||
  !/[^A-Za-z0-9]/.test(adminPassword)
) {
  fail('CLOUD_DEV_ADMIN_PASSWORD needs at least 8 characters, a number and a symbol.')
}

if (!secretKey) {
  fail(
    'SUPABASE_SECRET_KEY must be set to promote the Administrator account (D-029, D-061).',
  )
}

console.log(`Test accounts on ${new URL(url).host}:`)

let failures = 0

// 1. Standard Seeker and Host accounts
for (const account of standardAccounts) {
  // One client per account, so no session carries over to the next one.
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let outcome = 'registered'
  const { error: signUpError } = await supabase.auth.signUp({
    email: account.email,
    password,
    options: { data: { role: account.role, full_name: account.fullName } },
  })
  if (signUpError?.code === 'user_already_exists') {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: account.email,
      password,
    })
    if (signInError) {
      console.error(
        `  ${account.email}: exists, but CLOUD_DEV_ACCOUNT_PASSWORD does not sign it in (${signInError.message})`,
      )
      failures++
      continue
    }
    outcome = 'already registered'
  } else if (signUpError) {
    console.error(`  ${account.email}: sign-up failed (${signUpError.message})`)
    failures++
    continue
  }

  // Row-Level Security lets a signed-in user read only their own profile, which
  // the sign-up trigger created.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .single()
  if (profileError || profile.role !== account.role) {
    console.error(
      `  ${account.email}: expected role ${account.role}, found ${profile?.role ?? profileError?.message}`,
    )
    failures++
    continue
  }

  console.log(`  ${account.email}: ${outcome}, role ${profile.role}`)
}

// 2. Administrator account (D-061)
{
  const adminUserClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let adminOutcome = 'registered'
  let adminUserId = null

  // The sign-up trigger refuses `admin` (STORY-01), so the Administrator signs
  // up as a seeker and is promoted below with the secret key (D-061).
  const { data: signUpData, error: signUpError } = await adminUserClient.auth.signUp({
    email: adminAccount.email,
    password: adminPassword,
    options: { data: { role: 'seeker', full_name: adminAccount.fullName } },
  })

  if (signUpError?.code === 'user_already_exists') {
    const { data: signInData, error: signInError } =
      await adminUserClient.auth.signInWithPassword({
        email: adminAccount.email,
        password: adminPassword,
      })
    if (signInError) {
      console.error(
        `  ${adminAccount.email}: exists, but CLOUD_DEV_ADMIN_PASSWORD does not sign it in (${signInError.message})`,
      )
      failures++
    } else {
      adminUserId = signInData.user.id
      adminOutcome = 'already registered'
    }
  } else if (signUpError) {
    console.error(`  ${adminAccount.email}: sign-up failed (${signUpError.message})`)
    failures++
  } else if (!signUpData?.user?.id) {
    console.error(`  ${adminAccount.email}: sign-up returned no user ID`)
    failures++
  } else {
    adminUserId = signUpData.user.id
  }

  if (adminUserId) {
    const adminServiceClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Ensure email is confirmed so the Administrator can sign in immediately
    // even if email confirmation was enabled on the cloud project.
    const { error: confirmError } = await adminServiceClient.auth.admin.updateUserById(
      adminUserId,
      { email_confirm: true },
    )
    if (confirmError) {
      console.error(
        `  ${adminAccount.email}: email confirmation failed (${confirmError.message})`,
      )
      failures++
    }

    const { error: promoteError } = await adminServiceClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', adminUserId)

    if (promoteError) {
      console.error(
        `  ${adminAccount.email}: promotion to admin failed (${promoteError.message})`,
      )
      failures++
    } else {
      // Re-sign in to ensure a fresh authenticated session and verify credentials
      const { error: verifySignInError } = await adminUserClient.auth.signInWithPassword({
        email: adminAccount.email,
        password: adminPassword,
      })

      if (verifySignInError) {
        console.error(
          `  ${adminAccount.email}: sign-in verification failed (${verifySignInError.message})`,
        )
        failures++
      } else {
        // An Administrator can read every profile (STORY-01), so ask for this one.
        const { data: profile, error: profileError } = await adminUserClient
          .from('profiles')
          .select('role')
          .eq('id', adminUserId)
          .single()
        if (profileError || profile?.role !== adminAccount.role) {
          console.error(
            `  ${adminAccount.email}: expected role ${adminAccount.role}, found ${profile?.role ?? profileError?.message}`,
          )
          failures++
        } else {
          console.log(`  ${adminAccount.email}: ${adminOutcome}, role ${profile.role}`)
        }
      }
    }
  }
}

process.exit(failures === 0 ? 0 : 1)
