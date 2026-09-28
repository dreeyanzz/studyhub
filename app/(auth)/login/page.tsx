import type { Metadata } from 'next'
import Link from 'next/link'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { sanitizeReturnUrl } from '@/lib/validation/auth'

import { LoginForm } from './_components/login-form'

export const metadata: Metadata = { title: 'Log in' }

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  // proxy.ts sends people here with the page they wanted; login checks it again.
  const returnUrl = sanitizeReturnUrl(first(params.returnUrl), '')
  const linkFailed = first(params.error) === 'link'

  return (
    <Card className="w-full max-w-md self-start">
      <CardHeader>
        <h1 className="font-heading text-3xl font-semibold">Log in</h1>
        <p className="text-base text-muted-foreground">Welcome back to Worq.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {linkFailed && (
          <Alert role="status">
            <AlertDescription>
              That link is invalid or has expired. Log in, or sign up again.
            </AlertDescription>
          </Alert>
        )}
        <LoginForm returnUrl={returnUrl} />
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          New to Worq?
          <Link href="/register" className={buttonVariants({ variant: 'link' })}>
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
