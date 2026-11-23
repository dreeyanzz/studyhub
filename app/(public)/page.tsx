import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Armchair, BookOpen, Leaf, Search, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StartupLamp } from './_components/startup-lamp'
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
    text: 'Each Host draws a map of their Space, so you can choose the desk or room that suits your day.',
  },
  {
    title: 'Verified Amenities',
    text: 'Space listings describe the essentials, and an Administrator checks each Space before it goes public.',
  },
  {
    title: 'Reserve-Now Holds',
    text: 'Hold an open unit now with a sandbox reservation fee. No real money moves.',
  },
]

export default function Home() {
  return (
    <div className="discovery-home">
      <StartupLamp />
      <section
        className="discovery-hero discovery-container"
        aria-labelledby="hero-title"
      >
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
            Find your kind of study day. Worq brings Seekers and Hosts together around
            places to focus.
          </p>
          <div className="hero-actions">
            <Link href="/spaces" className={buttonVariants()}>
              <Search aria-hidden="true" size={18} /> Find a Space
            </Link>
            <Link href="/register" className={buttonVariants({ variant: 'outline' })}>
              Get started <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link href="#how-it-works" className={buttonVariants({ variant: 'outline' })}>
              How it works
            </Link>
          </div>
          {/* Honest about payments, as the footer is (D-005). */}
          <p className="discovery-caption">
            Reservation fees run in sandbox mode, so no real money moves.
          </p>
        </div>
        <div className="hero-visual">
          <Image
            src="/images/public-landing/workspace.webp"
            alt="Desks and chairs in an unoccupied shared office"
            width={1600}
            height={1067}
            sizes="(min-width: 64rem) 50vw, 100vw"
            loading="eager"
          />
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
              <p>Make time for what matters.</p>
            </div>
          </li>
          <li>
            <Armchair aria-hidden="true" />
            <div>
              <h2>Settle in</h2>
              <p>Imagine a comfortable study day.</p>
            </div>
          </li>
          <li>
            <Users aria-hidden="true" />
            <div>
              <h2>Feel connected</h2>
              <p>A community of Seekers and Hosts.</p>
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
            <p>Make room for a focused community. Start your journey as a Host.</p>
            <Link
              href="/register?role=host"
              className={buttonVariants({ variant: 'secondary' })}
            >
              Become a Host <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <ul className="host-benefits">
            <li>Welcome a community</li>
            <li>Share your Space</li>
            <li>Help ideas grow</li>
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
            Illustrative spaces, not live listings. These photos show possibilities, not
            bookable Spaces.
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
        </section>
      </div>

      <section
        id="how-it-works"
        className="discovery-container how-section"
        aria-labelledby="how-title"
      >
        <p className="discovery-eyebrow">Built around your study day</p>
        <h2 id="how-title">Know your spot before you go.</h2>
        <p className="discovery-caption">
          Search the map, pick your unit, and hold it before you leave.
        </p>
        <ol className="pillar-grid">
          {pillars.map((pillar, index) => (
            <li key={pillar.title}>
              <span className="pillar-number" aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
