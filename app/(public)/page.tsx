import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Armchair, BookOpen, Leaf, Search, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import './discovery.css'

// D-033: these are illustrative content, never inventory or interactive cards.
const examples = [
  {
    title: 'The reading room',
    kind: 'Library inspiration',
    image: 'library',
    text: 'A little room for a good book and a big idea.',
  },
  {
    title: 'Coffee & chapters',
    kind: 'Café inspiration',
    image: 'cafe',
    text: 'A change of scenery for your next chapter.',
  },
  {
    title: 'The shared desk',
    kind: 'Workspace inspiration',
    image: 'workspace',
    text: 'A setting for working alongside others.',
  },
  {
    title: 'A quiet corner',
    kind: 'Study inspiration',
    image: 'library',
    text: 'Make space for a slower, more thoughtful day.',
  },
]
const pillars = [
  {
    title: 'Snap-Grid Seat Map',
    step: 'Step 01',
    text: 'Every Host maps out their Space, so you can choose the exact desk or quiet corner that fits your day.',
  },
  {
    title: 'Verified Spaces & Tags',
    step: 'Step 02',
    text: 'Filter by curated amenities—from power outlets to fast Wi-Fi—on Spaces reviewed by an Administrator.',
  },
  {
    title: 'Reserve-Now Holds',
    step: 'Step 03',
    text: 'Lock in an open seat before you commute with a simple sandbox reservation fee, then scan your QR at the desk.',
  },
]

export default function Home() {
  return (
    <div className="discovery-home">
      <section className="discovery-hero" aria-labelledby="hero-title">
        <div className="hero-backdrop">
          <Image
            src="/images/public-landing/workspace.webp"
            alt="Desks and chairs in an unoccupied shared office"
            width={1600}
            height={1067}
            sizes="100vw"
            loading="eager"
          />
        </div>
        <div className="discovery-container hero-inner">
          <div className="hero-copy">
            <p className="discovery-eyebrow">
              <Leaf aria-hidden="true" size={20} /> A little room for big ideas
            </p>
            <h1 id="hero-title">
              Your space.
              <br />
              <em>Your focus.</em>
            </h1>
            <p className="hero-description">
              Find an open seat and hold it now. Worq connects Seekers with verified study
              and co-working Spaces—complete with seat maps and instant holds.
            </p>
            {/* Plain GET form works before JavaScript loads (STORY-17 §3, SRS §3.7.1). */}
            <form
              action="/spaces"
              method="get"
              role="search"
              aria-label="Search study Spaces"
              className="hero-search"
            >
              <div className="hero-search-field">
                <label htmlFor="hero-search-input" className="sr-only">
                  Search by campus, city, or Space name
                </label>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="hero-search-input"
                  name="q"
                  type="search"
                  maxLength={100}
                  placeholder="Search by campus, city, or Space name..."
                  className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-4 pl-10 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:text-sm"
                />
              </div>
              <button type="submit" className={buttonVariants({ className: 'shrink-0' })}>
                Search
              </button>
            </form>
            <div className="hero-actions">
              <Link href="/spaces" className={buttonVariants({ variant: 'outline' })}>
                <Search aria-hidden="true" size={18} /> Find a Space
              </Link>
              <Link href="/register" className={buttonVariants({ variant: 'outline' })}>
                Get started <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link
                href="#how-it-works"
                className={buttonVariants({ variant: 'outline' })}
              >
                How it works
              </Link>
            </div>
            {/* Honest about payments, as the footer is (D-005). */}
            <p className="discovery-caption">
              Reservation fees run in sandbox mode, so no real money moves.
            </p>
          </div>
          <p className="hero-note">
            <BookOpen aria-hidden="true" size={22} />
            <span>
              A space for you.
              <br />
              <strong>Study your way.</strong>
            </span>
          </p>
        </div>
      </section>

      <section className="discovery-container" aria-label="A thoughtful study day">
        <ul className="explanatory-panel">
          <li>
            <BookOpen aria-hidden="true" />
            <div>
              <h2>Find your focus</h2>
              <p>Discover quiet cafés, libraries, and co-working Spaces near you.</p>
            </div>
          </li>
          <li>
            <Armchair aria-hidden="true" />
            <div>
              <h2>Pick your seat</h2>
              <p>Check live seat maps before you head out.</p>
            </div>
          </li>
          <li>
            <Users aria-hidden="true" />
            <div>
              <h2>Settle right in</h2>
              <p>Hold your spot and check in with your booking QR.</p>
            </div>
          </li>
        </ul>
      </section>

      <div className="discovery-container discovery-bottom">
        <section id="for-hosts" className="host-promo" aria-labelledby="host-title">
          <Image
            src="/images/public-landing/workspace.webp"
            alt=""
            width={1600}
            height={1067}
            sizes="(min-width: 64rem) 30vw, 100vw"
          />
          <div className="host-copy">
            <p className="discovery-eyebrow">For Hosts</p>
            <h2 id="host-title">
              Your Space.
              <br />
              <em>Their next big idea.</em>
            </h2>
            <p>
              Welcome focused Seekers to your empty desks. Set up your Space, keep your
              seat map current, and manage check-ins with ease.
            </p>
            <Link
              href="/register?role=host"
              className={buttonVariants({ variant: 'secondary' })}
            >
              Become a Host <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <ul className="host-benefits">
            <li>Publish your seat map</li>
            <li>Keep availability live</li>
            <li>Verify check-ins in seconds</li>
          </ul>
        </section>
        <section
          className="example-section"
          aria-labelledby="examples-title"
          aria-describedby="examples-note"
        >
          <p className="discovery-eyebrow">Room to imagine</p>
          <h2 id="examples-title">What does your focus look like?</h2>
          <p id="examples-note" className="discovery-caption">
            Sample study environments to spark your day. Browse live Spaces on the map to
            book an open seat.
          </p>
          <ul className="example-grid">
            {examples.map((example) => (
              <li className="example-card" key={example.title}>
                <Image
                  src={`/images/public-landing/${example.image}.webp`}
                  alt=""
                  width={1600}
                  height={example.image === 'cafe' ? 2387 : 1067}
                  sizes="(min-width: 64rem) 20vw, (min-width: 40rem) 50vw, 100vw"
                />
                <div className="example-copy">
                  <p className="discovery-caption">{example.kind}</p>
                  <h3>{example.title}</h3>
                  <p>{example.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="example-cta">
            <div>
              <h3>Ready to find your seat?</h3>
              <p className="discovery-caption">
                Browse verified Spaces on the live map, filter by amenities, and hold an
                open desk now.
              </p>
            </div>
            <Link href="/spaces" className={buttonVariants()}>
              Explore Spaces <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </section>
      </div>

      <section
        id="how-it-works"
        className="discovery-container how-section"
        aria-labelledby="how-title"
      >
        <p className="discovery-eyebrow">Built around your study day</p>
        <h2 id="how-title">Know your spot before you go.</h2>
        <p className="discovery-caption">Three steps from search to settled in.</p>
        <ol className="pillar-grid">
          {pillars.map((pillar, index) => (
            <li key={pillar.title}>
              <span className="pillar-number" aria-hidden="true">
                0{index + 1}
              </span>
              <p className="discovery-caption">{pillar.step}</p>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
