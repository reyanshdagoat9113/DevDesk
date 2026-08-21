import { ArrowDown, Github, MonitorDown } from 'lucide-react'

import { Screenshot } from '@/components/Screenshot'
import { VaultPrompt } from '@/components/Prompt'
import { Badge, Button } from '@/components/ui'
import { heroScreenshot } from '@/config/screenshots'
import { APP_VERSION, GITHUB_URL } from '@/config/site'
import { usePreferredDownload } from '@/hooks/usePreferredDownload'

export function Hero() {
  const download = usePreferredDownload()

  return (
    <section id="top" className="relative">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14 lg:pt-20">
        <div className="flex w-full min-w-0 max-w-xl flex-col items-start gap-6 animate-slide-up">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px] tracking-wide">
              v{APP_VERSION} private beta
            </Badge>
            <Badge variant="secondary">Windows</Badge>
            <Badge variant="secondary">Linux</Badge>
            <Badge variant="secondary">MIT</Badge>
          </div>

          <h1 className="text-balance text-[2.6rem] font-semibold leading-[0.95] sm:text-5xl lg:text-[3.5rem]">
            Your machine.
            <br />
            One window.
          </h1>

          <div className="w-full min-w-0 max-w-md space-y-1 text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Projects, saved commands, Docker, terminals,
              <br className="sm:hidden" /> and local search.
            </p>
            <p>On this machine, in one window.</p>
          </div>

          <VaultPrompt className="w-full max-w-md" />

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {download ? (
              <Button asChild variant="default" size="xl" className="w-full sm:w-auto">
                <a href={download.url}>
                  <MonitorDown className="size-4" />
                  {download.platform === 'windows'
                    ? 'Download for Windows'
                    : 'Download for Linux'}
                </a>
              </Button>
            ) : (
              <Button asChild variant="default" size="xl" className="w-full sm:w-auto">
                <a href="#download">
                  <ArrowDown className="size-4" />
                  See download options
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <Github className="size-4" />
                Source
              </a>
            </Button>
          </div>

          <p className="w-full min-w-0 font-mono text-xs leading-relaxed text-muted-foreground">
            Local-first. No account. No telemetry.
            <br className="sm:hidden" /> No background daemons.
          </p>
        </div>

        <div className="relative w-full min-w-0 animate-fade-in delay-150">
          <Screenshot shot={heroScreenshot} priority className="relative" />
        </div>
      </div>
    </section>
  )
}
