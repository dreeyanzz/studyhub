import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { landingPathFor } from '@/lib/auth/role-guard'
import { createClient } from '@/lib/supabase/server'
import { parseRegistrationRole, sanitizeReturnUrl } from '@/lib/validation/auth'

import { AuthShell } from '../_components/auth-shell'
import { signOut } from '../actions'
import { ChooseRoleForm } from './_components/choose-role-form'

export const metadata: Metadata = { title: 'Finish setting up your account' }

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

// One-time role and full-name confirmation for brand-new Google OAuth accounts
// (STORY-21, D-095). Checks session and role_confirmed server-side as defense
// in depth even if proxy.ts is bypassed.
export default async function ChooseRolePage({
  searchParams,
}: PageProps<'/choose-role'>) {
  const params = await searchParams
  const returnUrl = sanitizeReturnUrl(first(params.returnUrl), '')
  const defaultRole = parseRegistrationRole(first(params.role))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, role_confirmed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')
  if (profile.role_confirmed) {
    redirect(landingPathFor(profile.role, returnUrl || undefined))
  }

  return (
    <AuthShell
      asideEyebrow="Worq · Study & Co-Working"
      asideTitle="One quick step."
      asideBody="Pick whether you are looking for a seat or listing your Space so Worq opens the right workspace for you."
      title="Finish setting up your account"
      subtitle={
        <>
          Signed in as{' '}
          <span className="font-medium break-all text-foreground">
            {user.email ?? 'your Google account'}
          </span>
          . Confirm your name and choose how you will use Worq.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ChooseRoleForm
          defaultFullName={profile.full_name ?? ''}
          defaultRole={defaultRole}
          returnUrl={returnUrl}
        />
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="h-auto min-h-12 w-full py-3 whitespace-normal"
          >
            Log out and use a different account
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}
