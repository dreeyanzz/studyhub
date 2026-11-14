// Supabase Auth sends people here from an email link, such as a sign-up
// confirmation, with a one-time code (D-010: a caller outside the app). The code
// becomes a session, and the person goes on to their dashboard.
import { NextResponse, type NextRequest } from 'next/server'

import { landingPathFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { sanitizeReturnUrl } from '@/lib/validation/auth'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const failed = NextResponse.redirect(new URL('/login?error=link', request.url))
  if (!code) return failed

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return failed

  // The role comes from profiles, never user_metadata (STORY-03 design §2).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()
  // A sign-up from a hold prompt goes back to its Space profile (D-058).
  const returnUrl = sanitizeReturnUrl(request.nextUrl.searchParams.get('returnUrl'), '')
  const destination = profile ? landingPathFor(profile.role, returnUrl || undefined) : '/'

  return NextResponse.redirect(new URL(destination, request.url))
}
