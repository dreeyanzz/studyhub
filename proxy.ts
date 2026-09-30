// Next 16's proxy (the old middleware.ts) runs before every page request. It
// refreshes the Supabase session and sends people to the pages their role may
// open (STORY-03 design §1). Server Actions go through to their own session check
// (#137). It is not the security boundary: Row-Level Security is, and every Server
// Action checks the user itself (D-007, D-010).
import type { NextRequest } from 'next/server'

import { evaluateRouteAccess } from '@/lib/auth/role-guard'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const session = await updateSession(request)
  const { pathname, search } = request.nextUrl
  const access = evaluateRouteAccess(pathname, session.role, search, request.method)

  return access.type === 'allow' ? session.next() : session.redirect(access.to)
}

export const config = {
  // Everything except static files and images, which need no session.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
