// Promotes a confirmed production account to Administrator (STORY-19, D-090, D-091).
//
// Database owner only. Reads PRODUCTION_SUPABASE_URL and PRODUCTION_SECRET_KEY
// from .env.local (never NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY) so it
// cannot accidentally promote an account on the shared cloud dev project or the
// local Docker stack.
//
// Usage:
//   npm run db:promote-admin -- <email>
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERS_PER_PAGE = 200
const MAX_LIST_PAGES = 50
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * Parses and validates the email CLI argument.
 * @param {string[]} args
 * @returns {{ ok: true, email: string } | { ok: false, error: string }}
 */
export function parseEmailArg(args) {
  const cleaned = args[0] === '--' ? args.slice(1) : args
  if (cleaned.length !== 1) {
    return {
      ok: false,
      error: 'Usage: npm run db:promote-admin -- <email>',
    }
  }

  const email = (cleaned[0] ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      error: `Invalid email address "${cleaned[0] ?? ''}". Pass the confirmed production account email.`,
    }
  }

  if (email.endsWith('@example.test')) {
    return {
      ok: false,
      error:
        'Refusing to promote an @example.test address on production (D-091). Use a real account signed up on worqph.vercel.app.',
    }
  }

  return { ok: true, email }
}

/**
 * Validates that production credentials are set and do not point to local or
 * cloud dev (NEXT_PUBLIC_SUPABASE_URL).
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true, url: string, host: string, secretKey: string } | { ok: false, error: string }}
 */
export function validateProductionEnv(env) {
  const rawUrl = env.PRODUCTION_SUPABASE_URL?.trim()
  const secretKey = env.PRODUCTION_SECRET_KEY?.trim()

  if (!rawUrl || !secretKey) {
    return {
      ok: false,
      error:
        'PRODUCTION_SUPABASE_URL and PRODUCTION_SECRET_KEY must be set in Adrian’s .env.local (D-090, D-091). This script never reads NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.',
    }
  }

  let parsedProdUrl
  try {
    parsedProdUrl = new URL(rawUrl)
  } catch {
    return {
      ok: false,
      error: `PRODUCTION_SUPABASE_URL is not a valid URL ("${rawUrl}").`,
    }
  }

  if (parsedProdUrl.protocol !== 'https:') {
    return {
      ok: false,
      error: `PRODUCTION_SUPABASE_URL must use https:// (got "${parsedProdUrl.protocol}").`,
    }
  }

  if (LOCAL_HOSTNAMES.has(parsedProdUrl.hostname.toLowerCase())) {
    return {
      ok: false,
      error:
        'PRODUCTION_SUPABASE_URL must not point to localhost or a loopback address (D-090).',
    }
  }

  const rawDevUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (rawDevUrl) {
    try {
      const parsedDevUrl = new URL(rawDevUrl)
      if (parsedDevUrl.origin === parsedProdUrl.origin) {
        return {
          ok: false,
          error:
            'PRODUCTION_SUPABASE_URL matches NEXT_PUBLIC_SUPABASE_URL. Refusing to run so cloud dev is not modified by mistake (D-090).',
        }
      }
    } catch {
      // Ignore malformed NEXT_PUBLIC_SUPABASE_URL; production URL was already validated.
    }
  }

  return {
    ok: true,
    url: parsedProdUrl.origin,
    host: parsedProdUrl.host,
    secretKey,
  }
}

/**
 * @typedef {{
 *   id: string,
 *   email?: string | null,
 *   email_confirmed_at?: string | null,
 * }} AuthUserLike
 *
 * @typedef {{
 *   auth: {
 *     admin: {
 *       listUsers: (params: { page: number, perPage: number }) => Promise<{
 *         data: { users: AuthUserLike[], nextPage?: number | null } | null,
 *         error: { message: string } | null,
 *       }>,
 *     },
 *   },
 *   from: (table: string) => {
 *     update: (values: { role: string, role_confirmed: boolean }) => {
 *       eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>,
 *     },
 *     select: (columns: string) => {
 *       eq: (column: string, value: string) => {
 *         single: () => Promise<{
 *           data: { role?: string | null, role_confirmed?: boolean | null } | null,
 *           error: { message: string } | null,
 *         }>,
 *       },
 *     },
 *   },
 * }} AdminSupabaseClientLike
 */

/**
 * Finds a confirmed user by email on the production Supabase project, sets
 * their profile role to `admin` (and `role_confirmed` to `true`, D-095), and
 * verifies the stored profile row.
 * @param {{
 *   supabase: AdminSupabaseClientLike,
 *   email: string,
 *   host: string,
 *   log?: (message: string) => void,
 * }} options
 * @returns {Promise<
 *   | { ok: true, userId: string, email: string, host: string, role: string, roleConfirmed: boolean }
 *   | { ok: false, error: string }
 * >}
 */
export async function promoteAdminAccount({
  supabase,
  email,
  host,
  log = (message) => console.log(message),
}) {
  log(`Target production project: ${host}`)

  /** @type {AuthUserLike | null} */
  let matchedUser = null

  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    })

    if (error) {
      return {
        ok: false,
        error: `Could not list accounts on ${host}: ${error.message}`,
      }
    }

    const users = data?.users ?? []
    const found = users.find((user) => user.email?.trim().toLowerCase() === email)
    if (found) {
      matchedUser = found
      break
    }

    if (users.length < USERS_PER_PAGE || data?.nextPage === null) {
      break
    }
  }

  if (!matchedUser) {
    return {
      ok: false,
      error: `No account found for ${email} on ${host}. Sign up on https://worqph.vercel.app/register and confirm its email first (D-091).`,
    }
  }

  if (!matchedUser.email_confirmed_at) {
    return {
      ok: false,
      error: `Account ${email} on ${host} has not confirmed its email address yet. Confirm the sign-up email before promoting it to Administrator (D-091).`,
    }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin', role_confirmed: true })
    .eq('id', matchedUser.id)

  if (updateError) {
    return {
      ok: false,
      error: `Failed to promote ${email} on ${host}: ${updateError.message}`,
    }
  }

  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('role, role_confirmed')
    .eq('id', matchedUser.id)
    .single()

  if (readError || profile?.role !== 'admin' || profile?.role_confirmed !== true) {
    return {
      ok: false,
      error: `Promotion verification failed for ${email} on ${host}: ${readError?.message ?? `role=${String(profile?.role)}, role_confirmed=${String(profile?.role_confirmed)}`}`,
    }
  }

  log(`Promoted ${email} on ${host} to Administrator (role=${profile.role}).`)

  return {
    ok: true,
    userId: matchedUser.id,
    email,
    host,
    role: profile.role,
    roleConfirmed: profile.role_confirmed,
  }
}

/**
 * CLI entrypoint.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
async function main(argv, env) {
  const emailResult = parseEmailArg(argv)
  if (!emailResult.ok) {
    console.error(emailResult.error)
    process.exitCode = 1
    return
  }

  const envResult = validateProductionEnv(env)
  if (!envResult.ok) {
    console.error(envResult.error)
    process.exitCode = 1
    return
  }

  const supabase = createClient(envResult.url, envResult.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const result = await promoteAdminAccount({
    supabase: /** @type {AdminSupabaseClientLike} */ (/** @type {unknown} */ (supabase)),
    email: emailResult.email,
    host: envResult.host,
  })

  if (!result.ok) {
    console.error(result.error)
    process.exitCode = 1
    return
  }

  // Not process.exit(): with fetch's sockets still open, it crashes Node 24 on Windows
  // with a libuv assertion (see scripts/register-cloud-accounts.mjs).
  process.exitCode = 0
}

const invokedPath = process.argv[1]
if (invokedPath && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  await main(process.argv.slice(2), process.env)
}
