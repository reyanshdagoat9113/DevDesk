import { Check } from 'lucide-react'

import { Screenshot } from '@/components/Screenshot'
import { featureRows, featureScreenshot } from '@/config/content'
import { cn } from '@/lib/utils'

export function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          The places you already work, in one window
        </h2>
        <p className="mt-3 text-muted-foreground">
          DevDesk mirrors how a local development day actually runs, instead of inventing a new
          workflow to learn.
        </p>
      </div>

      <div className="mt-16 flex flex-col gap-20">
        {featureRows.map((row, index) => {
          const Icon = row.icon
          const flipped = index % 2 === 1

          return (
            <article
              key={row.id}
              className="grid items-center gap-8 md:grid-cols-2 md:gap-12"
              aria-labelledby={`feature-${row.id}`}
            >
              <div className={cn('flex flex-col gap-4', flipped && 'md:order-2')}>
                <div className="flex items-center gap-2 text-brand">
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="text-xs font-medium uppercase tracking-widest">
                    {row.eyebrow}
                  </span>
                </div>

                <h3 id={`feature-${row.id}`} className="text-2xl font-semibold tracking-tight">
                  {row.title}
                </h3>

                <p className="text-muted-foreground">{row.body}</p>

                <ul className="flex flex-col gap-2">
                  {row.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                      <span className="text-muted-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Screenshot
                shot={featureScreenshot(row.id)}
                className={cn(flipped && 'md:order-1')}
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
