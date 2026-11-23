import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { sanitizeReturnUrl } from '@/lib/validation/auth'

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
      asideEyebrow="Worq · Study & Co-Working"
      asideTitle="Find your focus."
      asideBody="Create an account to hold an open desk before you commute, or list your Space and keep its seat map current."
      title="Create your account"
      subtitle="Join Worq as a Seeker or a Host."
    >
      <div className="flex flex-col gap-5">
        <RegisterForm returnUrl={returnUrl} defaultRole={defaultRole} />
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          Already have an account?
          <Link href={loginHref} className={buttonVariants({ variant: 'link' })}>
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
