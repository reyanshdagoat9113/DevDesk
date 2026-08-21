import {
  AlertTriangle,
  Apple,
  Download as DownloadIcon,
  Monitor,
  Terminal,
} from 'lucide-react'

import { SectionPath } from '@/components/Prompt'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import {
  APP_VERSION,
  RELEASE_URL,
  anyDownloadAvailable,
  downloads,
  macAvailable,
  systemRequirements,
} from '@/config/site'

export function Download() {
  const windows = downloads.filter((item) => item.platform === 'windows')
  const linux = downloads.filter((item) => item.platform === 'linux')

  return (
    <section id="download" className="scroll-mt-20 border-t border-border/40 bg-muted/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionPath segment="install" />
          <h2 className="text-balance text-3xl font-semibold sm:text-4xl">
            Download DevDesk {APP_VERSION}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            A private beta. Caveats are on the cards — not buried in a footnote.
          </p>
        </div>

        {!anyDownloadAvailable && (
          <Alert className="mt-8 max-w-2xl">
            <AlertTriangle className="size-4" />
            <AlertTitle>Installers not published yet</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Build locally with{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                npm run package:win
              </code>{' '}
              or{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                npm run package:linux
              </code>
              , or watch the{' '}
              <a
                href={RELEASE_URL}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                GitHub release
              </a>
              .
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="windows" className="mt-10 max-w-3xl">
          <TabsList className="grid h-auto w-full grid-cols-2 p-1">
            <TabsTrigger value="windows" className="gap-2 py-2.5">
              <Monitor className="size-4" aria-hidden="true" />
              Windows
            </TabsTrigger>
            <TabsTrigger value="linux" className="gap-2 py-2.5">
              <Terminal className="size-4" aria-hidden="true" />
              Linux
            </TabsTrigger>
          </TabsList>

          <TabsContent value="windows" className="mt-4 space-y-3">
            {windows.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </TabsContent>

          <TabsContent value="linux" className="mt-4 space-y-3">
            {linux.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System requirements</CardTitle>
              <CardDescription>What you need to run the beta</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2.5">
                {systemRequirements.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/40" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="size-4" aria-hidden="true" />
                macOS
              </CardTitle>
              <CardDescription>Not in this beta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {macAvailable
                  ? 'Available — see the release page for the macOS artifact.'
                  : 'Packaging and notarization are deferred. There is no timeline yet.'}
              </p>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">No auto-update</Badge>
                <Badge variant="outline">Unsigned Windows installer</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function ArtifactCard({
  artifact,
}: {
  artifact: (typeof downloads)[number]
}) {
  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="font-medium">{artifact.label}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{artifact.fileName}</p>
          <ul className="space-y-1 pt-1">
            {artifact.notes.map((note) => (
              <li key={note} className="text-xs text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
        <Button
          asChild={artifact.available}
          variant={artifact.available ? 'default' : 'secondary'}
          size="default"
          className="w-full shrink-0 sm:w-auto"
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
      </CardContent>
    </Card>
  )
}
