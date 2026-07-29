import { ArrowDown, ArrowRight, Github, MonitorDown, Sparkles } from 'lucide-react'

import { Screenshot } from '@/components/Screenshot'
import { Badge, Button } from '@/components/ui'
import { heroScreenshot } from '@/config/screenshots'
import { APP_VERSION, GITHUB_URL, primaryDownload, siteMeta } from '@/config/site'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Ambient brand wash — restrained, behind content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 top-0 size-[28rem] rounded-full bg-brand/10 blur-3xl dark:bg-brand/15" />
        <div className="absolute -right-16 top-32 size-[22rem] rounded-full bg-brand/5 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-12 sm:pt-20 md:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center animate-slide-up">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-brand/30 bg-brand/5 text-foreground">
              <Sparkles className="size-3 text-brand" aria-hidden="true" />
              v{APP_VERSION} private beta
            </Badge>
            <Badge variant="secondary">Windows</Badge>
            <Badge variant="secondary">Linux</Badge>
            <Badge variant="secondary">MIT</Badge>
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            One workspace for the{' '}
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
              projects, commands, and containers
            </span>{' '}
            you already have
          </h1>

          <p className="max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            {siteMeta.tagline}
          </p>

          <p className="text-sm text-muted-foreground">{siteMeta.trustLine}</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
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
                <ArrowRight className="size-4 opacity-60" />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl animate-fade-in delay-150 sm:mt-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-b from-brand/10 via-transparent to-transparent blur-2xl"
          />
          <Screenshot shot={heroScreenshot} priority className="relative" />
        </div>
      </div>
    </section>
  )
}
