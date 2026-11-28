// Cookie-free public Supabase client for cacheable/ISR Server Components
// (STORY-08, D-007, D-055). It never reads request cookies, so routes that only
// display public Verified Space data (such as /spaces) can be prerendered and
// revalidated with ISR instead of running dynamically on every request.
// Uses the publishable key, so Postgres Row-Level Security runs as `anon`.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See docs/DEVELOPMENT.md.',
    )
  }

  return createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
