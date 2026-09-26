// Supabase client for Server Components, Server Actions and route handlers
// (STORY-01, D-007, D-010). It reads the session from the request cookies and
// runs as that user with the publishable key, so Row-Level Security still
// applies. Create a new client for every request; never share one.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './database.types'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See docs/DEVELOPMENT.md.',
    )
  }

  // Next 16's cookies() is async.
  const cookieStore = await cookies()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies; only Server Actions and route
          // handlers can. Ignoring this is safe because proxy.ts (STORY-03)
          // refreshes the session and writes the cookies on every request.
        }
      },
    },
  })
}
