import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// The pillars are described in words with the sprint that delivers each one; no
// sample inventory or working-looking controls (STORY-02 design §3, D-002).
const pillars = [
  {
    title: 'Snap-Grid Seat Map',
    sprint: 'Sprint 2',
    text: 'Each Host draws a map of their Space, so you pick the exact seat, desk or room you want.',
  },
  {
    title: 'Verified Amenities',
    sprint: 'Sprint 2',
    text: 'Wi-Fi, power outlets and quiet zones are listed for every Space, and an Administrator checks a Space before it goes public.',
  },
  {
    title: 'Reserve-Now Holds',
    sprint: 'Sprint 3',
    text: 'Hold a seat that is open right now with a sandbox reservation fee, so it is still yours when you arrive.',
  },
]

const seekerBenefits = [
  'See which Spaces have open seats, and when the Host last updated them.',
  'Filter Spaces by what you need, such as Wi-Fi, outlets or quiet.',
  'Hold the exact seat you picked before you leave.',
]

const hostBenefits = [
  'List your Space and draw its seat map once.',
  'Mark seats open or taken as people come and go.',
  'Check Seekers in with the code on their booking.',
]

export default function Home() {
  return (
    <>
      <section className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-16">
        <h1 className="max-w-3xl font-heading text-4xl font-semibold sm:text-5xl">
          Find an open seat to study or work, and hold it before you leave.
        </h1>
        <p className="max-w-2xl text-lg">
          Worq helps Seekers find study and co-working Spaces with a seat open now. Hosts
          keep their seat maps up to date, so you know what to expect before you go.
        </p>
        <p className="max-w-2xl text-muted-foreground">
          Worq is being built in stages: accounts come first, then search in Sprint 2 and
          holds in Sprint 3.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/register" className={buttonVariants()}>
            Sign up
          </Link>
          <Link href="#how-it-works" className={buttonVariants({ variant: 'outline' })}>
            How it works
          </Link>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="scroll-mt-4 bg-secondary"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16">
          <h2 id="how-it-works-heading" className="font-heading text-3xl font-semibold">
            How it works
          </h2>
          {/* Columns are sized in rem, so enlarged text drops to fewer, wider cards
              instead of clipping them (STORY-02 design §4). */}
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
            {pillars.map((pillar) => (
              <li key={pillar.title}>
                <Card className="h-full">
                  <CardHeader>
                    <Badge variant="outline">Coming in {pillar.sprint}</Badge>
                    <CardTitle>
                      <h3 className="text-lg font-semibold">{pillar.title}</h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base">{pillar.text}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="benefits-heading"
        className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16"
      >
        <h2 id="benefits-heading" className="font-heading text-3xl font-semibold">
          Made for Seekers and Hosts
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <BenefitCard id="for-seekers" title="For Seekers" items={seekerBenefits} />
          <BenefitCard id="for-hosts" title="For Hosts" items={hostBenefits} />
        </div>
      </section>
    </>
  )
}

function BenefitCard({
  id,
  title,
  items,
}: {
  id: string
  title: string
  items: string[]
}) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader>
        <CardTitle>
          <h3 className="text-xl font-semibold">{title}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
