import { APP_VERSION, GITHUB_URL, SITE_URL, downloads, siteMeta } from '@/config/site'

/** SoftwareApplication JSON-LD for search engines. */
export function JsonLd() {
  const available = downloads.filter((item) => item.available)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteMeta.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Windows 10+, Linux x64',
    softwareVersion: APP_VERSION,
    license: 'https://opensource.org/licenses/MIT',
    description: siteMeta.tagline,
    url: SITE_URL,
    downloadUrl: available[0]?.url ?? `${GITHUB_URL}/releases`,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'DevDesk',
      url: GITHUB_URL,
    },
  }

  return (
    <script
      type="application/ld+json"
      // JSON-LD is trusted static content from our own config.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
