import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import { RegisterForm } from './_components/register-form'

export const metadata: Metadata = { title: 'Sign up' }

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-md self-start">
      <CardHeader>
        <h1 className="font-heading text-3xl font-semibold">Create your account</h1>
        <p className="text-base text-muted-foreground">
          Join Worq as a Seeker or a Host.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RegisterForm />
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          Already have an account?
          <Link href="/login" className={buttonVariants({ variant: 'link' })}>
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
