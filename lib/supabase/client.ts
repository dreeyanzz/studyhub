// Supabase client for Client Components (STORY-01, D-007). It runs as the
// signed-in user with the publishable key, so Row-Level Security decides what it
// can read and write. For Server Components and Server Actions, use server.ts.
import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'

export function createClient() {
  // Next.js inlines NEXT_PUBLIC_ variables at build time only when they are
  // written out in full like this, so they cannot come from a helper.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See docs/DEVELOPMENT.md.',
    )
  }

  return createBrowserClient<Database>(url, publishableKey)
}
