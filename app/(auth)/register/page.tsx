import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { sanitizeReturnUrl } from '@/lib/validation/auth'

import { RegisterForm } from './_components/register-form'

export const metadata: Metadata = { title: 'Sign up' }

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const params = await searchParams
  // A hold prompt sends people here with its Space profile and the Seeker role
  // (D-058, STORY-09). register checks returnUrl again.
  const returnUrl = sanitizeReturnUrl(first(params.returnUrl), '')
  const defaultRole = first(params.role) === 'seeker' ? 'seeker' : undefined
  const loginHref = returnUrl
    ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/login'

  return (
    <Card className="w-full max-w-md self-start">
      <CardHeader>
        <h1 className="font-heading text-3xl font-semibold">Create your account</h1>
        <p className="text-base text-muted-foreground">
          Join Worq as a Seeker or a Host.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RegisterForm returnUrl={returnUrl} defaultRole={defaultRole} />
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          Already have an account?
          <Link href={loginHref} className={buttonVariants({ variant: 'link' })}>
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
