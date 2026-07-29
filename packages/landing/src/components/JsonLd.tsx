import { faq, featureRows, secondaryFeatures } from '@/config/content'
import { screenshots } from '@/config/screenshots'
import { APP_VERSION, GITHUB_URL, SITE_URL, downloads, siteMeta } from '@/config/site'

/**
 * Structured data for search engines: the app itself plus the on-page FAQ.
 * Both entities are emitted in one @graph so they stay a single script tag.
 * Everything is derived from the same config the page renders, so the markup
 * cannot claim something the page does not show.
 */
export function JsonLd() {
  const available = downloads.filter((item) => item.available)

  const application = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}#app`,
    name: siteMeta.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Windows 10+, Linux x64',
    softwareVersion: APP_VERSION,
    license: 'https://opensource.org/licenses/MIT',
    description: siteMeta.tagline,
    url: SITE_URL,
    downloadUrl: available[0]?.url ?? `${GITHUB_URL}/releases`,
    isAccessibleForFree: true,
    screenshot: screenshots.map((shot) => ({
      '@type': 'ImageObject',
      contentUrl: `${SITE_URL}${shot.src}`,
      caption: shot.alt,
    })),
    featureList: [
      ...featureRows.map((row) => row.title),
      ...secondaryFeatures.map((item) => item.title),
    ],
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

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}#faq`,
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  const data = {
    '@context': 'https://schema.org',
    '@graph': [application, faqPage],
  }

  return (
    <script
      type="application/ld+json"
      // JSON-LD is trusted static content from our own config.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
