import { AlertTriangle, Apple, Download as DownloadIcon, Monitor, Terminal } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import {
  APP_VERSION,
  RELEASE_URL,
  anyDownloadAvailable,
  downloads,
  macAvailable,
  systemRequirements,
  type Platform,
} from '@/config/site'

const platformMeta: Record<Platform, { label: string; icon: typeof Monitor }> = {
  windows: { label: 'Windows', icon: Monitor },
  linux: { label: 'Linux', icon: Terminal },
}

const platforms: Platform[] = ['windows', 'linux']

export function Download() {
  return (
    <section id="download" className="border-t border-border/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Download DevDesk {APP_VERSION}
          </h2>
          <p className="mt-3 text-muted-foreground">
            A private beta. It works, and it is honest about what it does not do yet — the caveats
            are listed on the cards rather than in a footnote.
          </p>
        </div>

        {!anyDownloadAvailable && (
          <div
            role="status"
            className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Installers are not published yet. Build them locally with{' '}
              <code className="font-mono text-xs">npm run package:win</code> or{' '}
              <code className="font-mono text-xs">npm run package:linux</code>, or watch the
              repository for the release.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => {
            const artifacts = downloads.filter((item) => item.platform === platform)
            const { label, icon: Icon } = platformMeta[platform]

            return (
              <Card key={platform} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </CardTitle>
                  <CardDescription>
                    x64 · {artifacts.length === 1 ? '1 artifact' : `${artifacts.length} artifacts`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5 pt-6">
                  {artifacts.map((artifact) => (
                    <div key={artifact.id} className="flex flex-col gap-2">
                      <p className="text-sm font-medium">{artifact.label}</p>
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {artifact.fileName}
                      </p>
                      <Button
                        asChild={artifact.available}
                        variant={artifact.available ? 'brand' : 'secondary'}
                        size="sm"
                        className="w-fit"
                        disabled={!artifact.available}
                      >
                        {artifact.available ? (
                          <a href={artifact.url}>
                            <DownloadIcon className="size-4" />
                            Download
                          </a>
                        ) : (
                          <span>
                            <DownloadIcon className="size-4" />
                            Not published yet
                          </span>
                        )}
                      </Button>
                      <ul className="flex flex-col gap-1">
                        {artifact.notes.map((note) => (
                          <li key={note} className="text-xs text-muted-foreground">
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">System requirements</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {systemRequirements.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Apple className="size-4" aria-hidden="true" />
              macOS
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              {macAvailable
                ? 'Available — see the release page for the macOS artifact.'
                : 'Not available in this beta. macOS packaging and notarization are deferred; there is no timeline yet.'}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Every artifact and its checksum lives on the{' '}
              <a
                href={RELEASE_URL}
                target="_blank"
                rel="noreferrer"
                className="focus-brand rounded text-brand underline underline-offset-4"
              >
                GitHub release page
              </a>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">No auto-update</Badge>
              <Badge variant="outline">Unsigned installer</Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
