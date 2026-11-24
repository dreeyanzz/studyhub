// Supabase Auth sends people here from an email link or Google OAuth redirect
// with a one-time PKCE code or an OAuth error (D-010: a caller outside the app).
// The code becomes a session, confirmed accounts go to their dashboard or
// returnUrl, and brand-new OAuth accounts go to /choose-role (STORY-21, D-095).
import { NextResponse, type NextRequest } from 'next/server'

import { chooseRolePath, landingPathFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import {
  parseRegistrationRole,
  sanitizeAuthSource,
  sanitizeReturnUrl,
} from '@/lib/validation/auth'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const source = sanitizeAuthSource(params.get('source'))
  const returnUrl = sanitizeReturnUrl(params.get('returnUrl'), '')
  const roleHint = parseRegistrationRole(params.get('role'))

  const oauthError = params.get('error')
  if (oauthError) {
    // G2 (user cancelled on Google) vs G3 (other provider or Supabase OAuth error).
    const query = new URLSearchParams()
    query.set('error', oauthError === 'access_denied' ? 'oauth-cancelled' : 'oauth')
    if (returnUrl) query.set('returnUrl', returnUrl)
    if (source === '/register' && roleHint) query.set('role', roleHint)
    return NextResponse.redirect(new URL(`${source}?${query.toString()}`, request.url))
  }

  const code = params.get('code')
  const failed = NextResponse.redirect(new URL('/login?error=link', request.url))
  if (!code) return failed

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return failed

  // Both role and role_confirmed come from profiles, never user_metadata (STORY-03 §2, D-095).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, role_confirmed')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const destination = profile.role_confirmed
    ? landingPathFor(profile.role, returnUrl || undefined)
    : chooseRolePath(returnUrl || undefined, roleHint)

  return NextResponse.redirect(new URL(destination, request.url))
}
