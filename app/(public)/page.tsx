import { StartupLamp } from './_components/startup-lamp'
import { LandingPrototypeSwitcher } from './_prototypes/landing-prototype-switcher'
import './discovery.css'

export default function Home() {
  const showSwitcher =
    process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview'

  return (
    <>
      <StartupLamp />
      <LandingPrototypeSwitcher showSwitcher={showSwitcher} />
    </>
  )
}
