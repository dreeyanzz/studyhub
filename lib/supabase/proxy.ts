// Supabase adapter for proxy.ts (STORY-03, D-010). It refreshes the session on
// every request and reads the signed-in user's role for the route guard. This
// only routes people: Row-Level Security is the security boundary (D-007).
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { UserRole } from '@/lib/auth/role-guard'
import type { Database } from './database.types'

export type ProxySession = {
  /** The role in the user's own profiles row; null when signed out. */
  role: UserRole | null
  /** Continue to the page, with the refreshed session. */
  next: () => NextResponse
  /** Redirect to a path on this site, with the refreshed session. */
  redirect: (path: string) => NextResponse
}

type SessionCookie = { name: string; value: string; options: CookieOptions }

export async function updateSession(request: NextRequest): Promise<ProxySession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See docs/DEVELOPMENT.md.',
    )
  }

  // A refresh writes new session cookies. They go on the request, so the page
  // rendered after the proxy sees the new session, and on whichever response is
  // returned, so the browser keeps it, redirects included.
  // setAll can run more than once, and only its first call carries the headers.
  const sessionCookies = new Map<string, SessionCookie>()
  const cacheHeaders: Record<string, string> = {}

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value)
          sessionCookies.set(cookie.name, cookie)
        }
        // Stops a CDN from serving one user's session cookies to another.
        Object.assign(cacheHeaders, headers)
      },
    },
  })

  // getUser() asks Supabase Auth to check the token, refreshing it if it expired.
  // Nothing may run between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: UserRole | null = null
  if (user) {
    // Never user_metadata: a user can rewrite their own (STORY-03 design §2).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    role = profile?.role ?? null
  }

  function withSession(response: NextResponse) {
    for (const { name, value, options } of sessionCookies.values()) {
      response.cookies.set(name, value, options)
    }
    for (const [key, value] of Object.entries(cacheHeaders)) {
      response.headers.set(key, value)
    }
    return response
  }

  return {
    role,
    next: () => withSession(NextResponse.next({ request: { headers: request.headers } })),
    redirect: (path) => withSession(NextResponse.redirect(new URL(path, request.url))),
  }
}
