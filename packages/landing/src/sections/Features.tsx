import { Check } from 'lucide-react'

import { Screenshot } from '@/components/Screenshot'
import { Badge } from '@/components/ui'
import { featureRows, featureScreenshot, type FeatureRow } from '@/config/content'
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

      <div className="mt-14 flex flex-col gap-14 sm:mt-20 sm:gap-20">
        {featureRows.map((row) =>
          row.showScreenshot === false ? (
            <SummaryRow key={row.id} row={row} />
          ) : (
            <ShotRow key={row.id} row={row} />
          ),
        )}
      </div>
    </section>
  )
}

/**
 * Copy-only row, styled as a deliberate summary band so it reads as a designed
 * block rather than a row whose screenshot failed to load. Used for Projects,
 * whose capture is already the hero image.
 */
function SummaryRow({ row }: { row: FeatureRow }) {
  return (
    <article
      aria-labelledby={`feature-${row.id}`}
      className="rounded-2xl border border-border/60 bg-muted/20 p-6 sm:p-10"
    >
      <div className="max-w-2xl">
        <FeatureHeader row={row} />
        <p className="mt-4 text-pretty text-muted-foreground">{row.body}</p>
      </div>
      <FeatureBullets
        bullets={row.bullets}
        className="mt-8 border-t border-border/50 pt-6 sm:grid sm:grid-cols-3 sm:gap-6"
      />
    </article>
  )
}

/** Full-width capture with the copy split into two columns above it. */
function ShotRow({ row }: { row: FeatureRow }) {
  return (
    <article aria-labelledby={`feature-${row.id}`} className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="max-w-2xl">
          <FeatureHeader row={row} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <p className="text-pretty text-muted-foreground">{row.body}</p>
          <FeatureBullets bullets={row.bullets} />
        </div>
      </div>
      <Screenshot shot={featureScreenshot(row.id)} />
    </article>
  )
}

function FeatureHeader({ row }: { row: FeatureRow }) {
  const Icon = row.icon

  return (
    <>
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
        className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {row.title}
      </h3>
    </>
  )
}

function FeatureBullets({ bullets, className }: { bullets: string[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {bullets.map((bullet) => (
        <li key={bullet} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <Check className="size-3 text-brand" aria-hidden="true" />
          </span>
          <span className="text-muted-foreground">{bullet}</span>
        </li>
      ))}
    </ul>
  )
}
