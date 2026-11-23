import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { sanitizeReturnUrl } from '@/lib/validation/auth'
import { cn } from '@/lib/utils'

import { AuthShell } from '../_components/auth-shell'
import { RegisterForm } from './_components/register-form'

export const metadata: Metadata = { title: 'Sign up' }

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const params = await searchParams
  // A hold prompt sends people here with its Space profile and the Seeker role
  // (D-058, STORY-09); the landing page's "Become a Host" sends the Host role. The
  // role only preselects a radio: register validates the submitted role again, and
  // never accepts admin (D-013). register checks returnUrl again.
  const returnUrl = sanitizeReturnUrl(first(params.returnUrl), '')
  const role = first(params.role)
  const defaultRole = role === 'seeker' || role === 'host' ? role : undefined
  const loginHref = returnUrl
    ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/login'

  return (
    <AuthShell
      title="Start your focus"
      subtitle="Create your Worq account as a Seeker or a Host."
    >
      <div className="flex flex-col gap-5">
        <RegisterForm returnUrl={returnUrl} defaultRole={defaultRole} />
        <p className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted-foreground">
          Already have an account?
          <Link
            href={loginHref}
            className={cn(
              buttonVariants({ variant: 'link' }),
              'px-1.5 font-semibold text-foreground',
            )}
          >
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
