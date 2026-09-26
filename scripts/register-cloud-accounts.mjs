// Registers the shared test accounts in the cloud dev project (D-028). It signs
// up through Supabase Auth, the same path /register uses, so the sign-up trigger
// gives each account its role. Safe to re-run: an account that already exists is
// signed in instead, and every account's role is checked either way.
//
// Database owner only. Reads NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and CLOUD_DEV_ACCOUNT_PASSWORD:
//   npm run db:accounts      with the values in .env.local
//
// Never an Administrator: D-013 keeps that account out of every cloud project,
// and the sign-up trigger refuses the role anyway.
import { createClient } from '@supabase/supabase-js'

// The same invented people as supabase/seed.sql.
const accounts = [
  { email: 'host@example.test', role: 'host', fullName: 'Hugo Santos' },
  { email: 'host2@example.test', role: 'host', fullName: 'Hana Villanueva' },
  { email: 'seeker@example.test', role: 'seeker', fullName: 'Sam Dela Cruz' },
]

// supabase/seed.sql publishes this password, and the repository is public.
const seedPassword = 'Worq-demo-2026'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const password = process.env.CLOUD_DEV_ACCOUNT_PASSWORD

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

console.log(`Test accounts on ${new URL(url).host}:`)

let failures = 0
for (const account of accounts) {
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

process.exit(failures === 0 ? 0 : 1)
