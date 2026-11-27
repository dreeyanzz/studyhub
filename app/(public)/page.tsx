import { StartupLamp } from './_components/startup-lamp'
import { LandingPrototypeSwitcher } from './_prototypes/landing-prototype-switcher'
import './discovery.css'

export default function Home() {
  return (
    <>
      <StartupLamp />
      <LandingPrototypeSwitcher />
    </>
  )
}
