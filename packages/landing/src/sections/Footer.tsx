import { Wordmark } from '@/components/Logo'
import { Separator } from '@/components/ui'
import { APP_VERSION, GITHUB_URL, siteMeta } from '@/config/site'

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Download', href: '#download' },
      { label: 'Install guide', href: siteMeta.docsUrl, external: true },
    ],
  },
  {
    heading: 'Project',
    links: [
      { label: 'Source on GitHub', href: GITHUB_URL, external: true },
      { label: 'Licence (MIT)', href: `${GITHUB_URL}/blob/main/LICENSE`, external: true },
      {
        label: 'Release notes',
        href: `${GITHUB_URL}/blob/main/docs/RELEASE-NOTES-0.1.0.md`,
        external: true,
      },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Report an issue', href: siteMeta.supportUrl, external: true },
      {
        label: 'Where data is stored',
        href: `${GITHUB_URL}/blob/main/docs/data-locations.md`,
        external: true,
      },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
            <Wordmark />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {siteMeta.trustLine}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {column.heading}
              </h2>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                      className="focus-brand rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            DevDesk {APP_VERSION} · {siteMeta.license} licence
          </p>
          <p>Built for local development. No accounts, no servers, no tracking.</p>
        </div>
      </div>
    </footer>
  )
}
