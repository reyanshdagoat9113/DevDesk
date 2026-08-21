import { useLayoutEffect } from 'react'

import { JsonLd } from './components/JsonLd'
import { Download } from './sections/Download'
import { Features } from './sections/Features'
import { Footer } from './sections/Footer'
import { Honesty } from './sections/Honesty'
import { HowItWorks } from './sections/HowItWorks'
import { Hero } from './sections/Hero'
import { Nav } from './sections/Nav'
import { SecondaryFeatures } from './sections/SecondaryFeatures'
import { TrustStrip } from './sections/TrustStrip'

/** Single scrolling page; section order follows docs/landing-page-plan.md section 5. */
export function App() {
  useLayoutEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [])

  return (
    <>
      <JsonLd />
      <Nav />
      <main id="main">
        <Hero />
        <TrustStrip />
        <Features />
        <SecondaryFeatures />
        <HowItWorks />
        <Download />
        <Honesty />
      </main>
      <Footer />
    </>
  )
}
