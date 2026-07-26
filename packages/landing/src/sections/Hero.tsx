import { ArrowDown, Github, MonitorDown } from 'lucide-react'

import { Screenshot } from '@/components/Screenshot'
import { Badge, Button } from '@/components/ui'
import { heroScreenshot } from '@/config/screenshots'
import { APP_VERSION, GITHUB_URL, primaryDownload } from '@/config/site'

export function Hero() {
  return (
    <section id="top" className="mx-auto w-full max-w-6xl px-6 pb-8 pt-16 md:pt-24">
      <div className="flex max-w-3xl flex-col gap-6 animate-slide-up">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">v{APP_VERSION} private beta</Badge>
          <Badge variant="outline">Windows</Badge>
          <Badge variant="outline">Linux</Badge>
          <Badge variant="outline">MIT</Badge>
        </div>

        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          One workspace for the projects, commands, and containers you already have
        </h1>

        <p className="text-pretty text-lg text-muted-foreground">
          DevDesk is a local-first desktop app that combines a project manager, command vault,
          Docker controls, terminals, and local code search — so the tools around your code stop
          being twelve scattered windows.
        </p>

        <p className="text-sm text-muted-foreground">
          No account. Nothing leaves your machine. Free and MIT-licensed.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {primaryDownload ? (
            <Button asChild variant="brand" size="xl">
              <a href={primaryDownload.url}>
                <MonitorDown className="size-4" />
                {primaryDownload.platform === 'windows'
                  ? 'Download for Windows'
                  : `Download ${primaryDownload.label}`}
              </a>
            </Button>
          ) : (
            <Button asChild variant="brand" size="xl">
              <a href="#download">
                <ArrowDown className="size-4" />
                See download options
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="xl">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github className="size-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-12 animate-fade-in delay-150">
        <Screenshot shot={heroScreenshot} priority />
      </div>
    </section>
  )
}
