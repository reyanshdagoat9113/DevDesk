import { Check } from 'lucide-react'

import { Screenshot } from '@/components/Screenshot'
import { Badge } from '@/components/ui'
import { featureRows, featureScreenshot } from '@/config/content'
import { cn } from '@/lib/utils'

export function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="outline" className="mb-4">
          Features
        </Badge>
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          The places you already work, in one window
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground">
          DevDesk mirrors how a local development day actually runs, instead of inventing a new
          workflow to learn.
        </p>
      </div>

      <div className="mt-14 flex flex-col gap-16 sm:mt-20 sm:gap-24">
        {featureRows.map((row, index) => {
          const Icon = row.icon
          const flipped = index % 2 === 1

          return (
            <article
              key={row.id}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
              aria-labelledby={`feature-${row.id}`}
            >
              <div className={cn('flex flex-col gap-4', flipped && 'lg:order-2')}>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10">
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-widest text-brand">
                    {row.eyebrow}
                  </span>
                </div>

                <h3
                  id={`feature-${row.id}`}
                  className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {row.title}
                </h3>

                <p className="text-pretty text-muted-foreground">{row.body}</p>

                <ul className="mt-1 flex flex-col gap-2.5">
                  {row.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10">
                        <Check className="size-3 text-brand" aria-hidden="true" />
                      </span>
                      <span className="text-muted-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Screenshot
                shot={featureScreenshot(row.id)}
                className={cn(flipped && 'lg:order-1')}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
