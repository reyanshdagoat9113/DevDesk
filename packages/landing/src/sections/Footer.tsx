import { Wordmark } from '@/components/Logo'
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
      { label: 'Release notes', href: `${GITHUB_URL}/blob/main/docs/RELEASE-NOTES-0.1.0.md`, external: true },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Report an issue', href: siteMeta.supportUrl, external: true },
      { label: 'Where data is stored', href: `${GITHUB_URL}/blob/main/docs/data-locations.md`, external: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-xs text-sm text-muted-foreground">{siteMeta.trustLine}</p>
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
                      {...('external' in link && link.external
                        ? { target: '_blank', rel: 'noreferrer' }
                        : {})}
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

        <div className="mt-12 flex flex-col gap-2 border-t border-border/50 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            DevDesk {APP_VERSION} · {siteMeta.license} licence
          </p>
          <p>Built for local development. No accounts, no servers, no tracking.</p>
        </div>
      </div>
    </footer>
  )
}
