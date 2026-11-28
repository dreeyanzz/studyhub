import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  LayoutGrid,
  QrCode,
  Search,
  Sparkles,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StartupLamp } from './_components/startup-lamp'
import './discovery.css'

// D-033: illustrative study environment gallery, never inventory or interactive cards.
const environments = [
  {
    title: 'The reading room',
    kind: 'Quiet Library',
    image: 'library',
    crop: 'object-center',
    text: 'Long oak tables, natural daylight, and uninterrupted silence for deep reading.',
  },
  {
    title: 'Coffee & chapters',
    kind: 'Ambient Café',
    image: 'cafe',
    crop: 'object-center',
    text: 'Warm ambient light and espresso within reach for your next draft.',
  },
  {
    title: 'The shared desk',
    kind: 'Co-Working Studio',
    image: 'workspace',
    crop: 'object-left',
    text: 'Ergonomic desks, fast Wi-Fi, and power outlets at every seat.',
  },
] as const

const workflowCards = [
  {
    step: '01',
    title: 'Snap-Grid Seat Map',
    text: 'Hosts publish their floor plan on a 6-column snap grid, so you see open desks, standing tables, and rooms before you travel.',
  },
  {
    step: '02',
    title: 'Verified Spaces & Tags',
    text: 'Every Space is verified by an Administrator and filterable by curated Wi-Fi, power outlet, quietness, and price-tier tags.',
  },
  {
    step: '03',
    title: 'Reserve-Now Holds',
    text: 'Hold your exact seat with a sandbox reservation fee, walk in within your wait window, and check in with your booking QR.',
  },
] as const

const stageUnits = [
  { id: 'S1', state: 'open' },
  { id: 'S2', state: 'open' },
  { id: 'S3', state: 'taken' },
  { id: 'S4', state: 'selected' },
  { id: 'S5', state: 'open' },
  { id: 'S6', state: 'reserved' },
] as const

export default function Home() {
  return (
    <div className="discovery-home">
      <StartupLamp />

      {/* 1. Centered Luminous Daylight Aurora Hero + Elevated Glass Bento Product Stage */}
      <section className="aurora-hero" aria-labelledby="hero-title">
        <div className="discovery-container aurora-hero-inner">
          <div className="aurora-hero-copy">
            <p className="aurora-pill">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              <span>Metro Cebu · Verified Study &amp; Co-Working Spaces</span>
            </p>

            <h1 id="hero-title" className="aurora-display">
              Find your seat.
              <br />
              <span className="aurora-gradient-text">Lock in your focus.</span>
            </h1>

            <p className="aurora-lead">
              Explore Administrator-verified study rooms, quiet cafés, and co-working
              desks. Inspect Host-updated seat maps and hold an open unit before you
              commute.
            </p>

            {/* Centered Floating Frosted-Glass Search Capsule (Plain GET form, SRS §3.7.1) */}
            <form
              action="/spaces"
              method="get"
              role="search"
              aria-label="Search study Spaces"
              className="aurora-search-capsule"
            >
              <div className="aurora-search-field">
                <label htmlFor="hero-search-input" className="sr-only">
                  Search by campus, city, or Space name
                </label>
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
                  aria-hidden="true"
                />
                <input
                  id="hero-search-input"
                  name="q"
                  type="search"
                  maxLength={100}
                  placeholder="Search campus, city, or Space..."
                  className="min-h-12 w-full min-w-0 rounded-xl bg-transparent pr-3 pl-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:text-sm"
                />
              </div>
              {/* cn(), so whitespace-normal replaces the base nowrap: the label wraps at 200% text (D-031). */}
              <button
                type="submit"
                className={cn(
                  buttonVariants(),
                  'h-auto min-h-12 max-w-full rounded-xl bg-gradient-to-r from-primary to-forest-mid px-6 py-2 font-semibold whitespace-normal text-white shadow-sm hover:from-primary-hover hover:to-forest-deep',
                )}
              >
                <span>Search Spaces</span>
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            </form>

            <div className="aurora-quick-row">
              <Link
                href="/spaces"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'h-auto min-h-12 max-w-full rounded-full border-border bg-white/90 px-5 py-2 font-semibold whitespace-normal text-foreground shadow-2xs hover:border-primary/40 hover:bg-white',
                )}
              >
                <Compass aria-hidden="true" size={16} className="text-primary" /> Find a
                Space
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'h-auto min-h-12 max-w-full rounded-full px-4 py-2 font-semibold whitespace-normal text-foreground hover:bg-white/75',
                )}
              >
                Get started <ArrowUpRight aria-hidden="true" size={16} />
              </Link>
            </div>

            {/* Honest about payments, as the footer is (D-005). */}
            <p className="aurora-sandbox-note">
              Reservation fees run in sandbox mode, so no real money moves.
            </p>
          </div>

          {/* Centerpiece Elevated Frosted-Glass Bento Product Stage (Illustrative, aria-hidden) */}
          <div className="aurora-stage" aria-hidden="true">
            <div className="aurora-stage-main">
              <Image
                src="/images/public-landing/library.webp"
                alt=""
                width={1600}
                height={1067}
                sizes="(min-width: 64rem) 56vw, 100vw"
                loading="eager"
              />
              <div className="aurora-stage-float">
                <span className="aurora-stage-dot" />
                <span>Verified Space · Snap-Grid Floor Plan</span>
              </div>
            </div>

            <div className="aurora-stage-side">
              {/* Airy White-Glass Miniature Seat-Map Card */}
              <div className="aurora-stage-widget">
                <div className="aurora-widget-top">
                  <div>
                    <p className="aurora-widget-eyebrow">Zone A · Quiet Desks</p>
                    <p className="aurora-widget-title">Seat Availability</p>
                  </div>
                  <span className="aurora-widget-pill">4 / 6 Open</span>
                </div>

                <div className="aurora-widget-grid">
                  {stageUnits.map((u) => (
                    <div key={u.id} className={`aurora-unit-tile is-${u.state}`}>
                      <span>{u.id}</span>
                    </div>
                  ))}
                </div>

                <div className="aurora-widget-foot">
                  <span>Selected: S4 · Power Outlet</span>
                  <span className="aurora-widget-mint">Ready to hold</span>
                </div>
              </div>

              {/* Dual Ambient Photo Tiles */}
              <div className="aurora-stage-pair">
                <div className="aurora-pair-tile">
                  <Image
                    src="/images/public-landing/cafe.webp"
                    alt=""
                    width={1600}
                    height={2387}
                    sizes="(min-width: 64rem) 18vw, 50vw"
                    loading="eager"
                  />
                  <span>Café Study</span>
                </div>
                <div className="aurora-pair-tile">
                  <Image
                    src="/images/public-landing/workspace.webp"
                    alt=""
                    width={1600}
                    height={1067}
                    sizes="(min-width: 64rem) 18vw, 50vw"
                    loading="eager"
                  />
                  <span>Shared Desk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Floating 3-Card Sculptural Feature Bento */}
      <section
        className="discovery-container aurora-pillars-wrap"
        aria-label="Key benefits"
      >
        <ol className="aurora-pillars">
          <li className="aurora-pillar-card">
            <div className="aurora-icon-orb is-emerald" aria-hidden="true">
              <Compass size={22} />
            </div>
            <h2>Find your focus</h2>
            <p>
              Search verified cafés, quiet libraries, and co-working desks around campuses
              and study hubs across Metro Cebu.
            </p>
          </li>
          <li className="aurora-pillar-card">
            <div className="aurora-icon-orb is-brass" aria-hidden="true">
              <LayoutGrid size={22} />
            </div>
            <h2>Pick your exact seat</h2>
            <p>
              Inspect Host-updated snap-grid layouts, operating hours, and curated amenity
              tags before heading out.
            </p>
          </li>
          <li className="aurora-pillar-card">
            <div className="aurora-icon-orb is-sage" aria-hidden="true">
              <QrCode size={22} />
            </div>
            <h2>Check in effortlessly</h2>
            <p>
              Hold your chosen desk with a sandbox fee and present your booking QR code or
              token at the front desk.
            </p>
          </li>
        </ol>
      </section>

      {/* 3. Light-Glass Curated Environments Gallery (D-033) */}
      <section
        className="discovery-container aurora-gallery-section"
        aria-labelledby="examples-title"
        aria-describedby="examples-note"
      >
        <div className="aurora-section-head">
          <p className="aurora-eyebrow">Environments</p>
          <h2 id="examples-title">Spaces shaped around how you study.</h2>
          <p id="examples-note" className="aurora-section-desc">
            Sample study settings to spark your day. Browse verified Spaces on the map to
            check current seat availability and hold an open unit.
          </p>
        </div>

        <ul className="aurora-gallery-grid">
          {environments.map((item) => (
            <li key={item.title} className="aurora-gallery-card">
              <div className="aurora-gallery-media">
                <Image
                  src={`/images/public-landing/${item.image}.webp`}
                  alt=""
                  width={1600}
                  height={item.image === 'cafe' ? 2387 : 1067}
                  sizes="(min-width: 64rem) 31vw, 100vw"
                  className={item.crop}
                />
              </div>
              <div className="aurora-gallery-glass">
                <span className="aurora-gallery-kind">{item.kind}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Deep Midnight Cosmos Luminous Glass Workflow (#how-it-works) */}
      <section
        id="how-it-works"
        className="aurora-cosmos-band"
        aria-labelledby="how-title"
      >
        <div className="discovery-container">
          <div className="aurora-cosmos-head">
            <p className="aurora-cosmos-eyebrow">How Worq Works</p>
            <h2 id="how-title">From map search to your reserved desk.</h2>
            <p className="aurora-cosmos-sub">
              Three transparent steps built around Host-updated occupancy and instant
              front-desk QR verification.
            </p>
          </div>

          <ol className="aurora-cosmos-grid">
            {workflowCards.map((card) => (
              <li key={card.step} className="aurora-cosmos-card">
                <span className="aurora-cosmos-step" aria-hidden="true">
                  {card.step}
                </span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Radiant Indigo-to-Midnight Host CTA Showcase (#for-hosts) */}
      <section
        id="for-hosts"
        className="discovery-container aurora-host-wrap"
        aria-labelledby="host-title"
      >
        <div className="aurora-host-banner">
          <div className="aurora-host-copy">
            <p className="aurora-host-eyebrow">For Space Hosts</p>
            <h2 id="host-title">Your Space. Their next breakthrough.</h2>
            <p className="aurora-host-desc">
              List your study hall, quiet café, or co-working floor. Build your snap-grid
              seat map once, update occupancy in one tap, and verify Seeker check-ins via
              QR.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/register?role=host"
                className={cn(
                  buttonVariants({ variant: 'brass' }),
                  'h-auto min-h-12 max-w-full rounded-xl px-7 py-2 font-bold whitespace-normal shadow-md',
                )}
              >
                Become a Host <ArrowRight aria-hidden="true" size={16} />
              </Link>
              <Link
                href="/for-hosts"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'h-auto min-h-12 max-w-full rounded-xl border-white/25 bg-white/10 px-6 py-2 font-semibold whitespace-normal text-white backdrop-blur hover:border-brass/60 hover:bg-white/18 hover:text-white',
                )}
              >
                For Hosts overview <ArrowUpRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>

          <ul className="aurora-host-pills">
            <li>
              <span className="aurora-host-check" aria-hidden="true">
                <Check size={15} />
              </span>
              <div>
                <strong>Visual 6-column seat map</strong>
                <span>Arrange desks, standing tables, and rooms by zone.</span>
              </div>
            </li>
            <li>
              <span className="aurora-host-check" aria-hidden="true">
                <Check size={15} />
              </span>
              <div>
                <strong>One-tap occupancy updates</strong>
                <span>Keep walk-in and reserved seats accurate all day.</span>
              </div>
            </li>
            <li>
              <span className="aurora-host-check" aria-hidden="true">
                <Check size={15} />
              </span>
              <div>
                <strong>Instant QR &amp; token check-in</strong>
                <span>Scan Seeker passes directly from the Host check-in desk.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
