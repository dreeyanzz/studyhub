// The secret-key Supabase client (D-007, D-010). It bypasses Row-Level Security, so
// ESLint lets only app/api route handlers import it, and only where a design doc
// justifies it: STORY-09's payment webhook, which alone may call confirm_payment
// (design §2, N7). Server only; the key never has NEXT_PUBLIC_. Create one per
// request.
import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set. See docs/DEVELOPMENT.md.',
    )
  }

  // No user session: nothing to keep, refresh or read from the URL.
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
