import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { SITE_URL } from './config/site'
import './index.css'

/** Promote relative SEO tags to absolute URLs for crawlers. */
function applyAbsoluteSeo() {
  const absolute = (path: string) =>
    path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

  for (const id of ['og-image', 'twitter-image'] as const) {
    const el = document.getElementById(id)
    if (el instanceof HTMLMetaElement && el.content) {
      el.content = absolute(el.content)
    }
  }

  const canonical = document.getElementById('canonical-link')
  if (canonical instanceof HTMLLinkElement) {
    canonical.href = `${SITE_URL}/`
  }

  let ogUrl = document.querySelector('meta[property="og:url"]')
  if (!ogUrl) {
    ogUrl = document.createElement('meta')
    ogUrl.setAttribute('property', 'og:url')
    document.head.appendChild(ogUrl)
  }
  ogUrl.setAttribute('content', `${SITE_URL}/`)
}

applyAbsoluteSeo()

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root container #root was not found')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
