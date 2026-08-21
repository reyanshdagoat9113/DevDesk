import { useEffect, useMemo, useState } from 'react'

import { SectionPath } from '@/components/Prompt'
import { Screenshot } from '@/components/Screenshot'
import { featureRows, featureScreenshot, type FeatureRow } from '@/config/content'
import { cn } from '@/lib/utils'

export function Features() {
  const ids = useMemo(() => featureRows.map((row) => row.id), [])
  const active = useActiveFeature(ids)

  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionPath segment="features" />
        <h2 className="text-balance text-3xl font-semibold sm:text-4xl">
          The places you already work, in one window
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground">
          DevDesk follows a local development day instead of inventing a workflow to learn.
        </p>
      </div>

      <div className="mt-12 lg:mt-16 lg:grid lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:items-start lg:gap-12">
        <nav
          aria-label="Feature list"
          className="sticky top-24 hidden lg:block"
        >
          <ol className="flex flex-col gap-0.5 border-l border-border/60">
            {featureRows.map((row) => {
              const isActive = active === row.id
              return (
                <li key={row.id}>
                  <a
                    href={`#feature-${row.id}`}
                    className={cn(
                      'focus-brand -ml-px block border-l py-1.5 pl-4 font-mono text-xs transition-colors',
                      isActive
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {row.eyebrow}
                  </a>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex flex-col gap-16 sm:gap-20">
          {featureRows.map((row) =>
            row.showScreenshot === false ? (
              <SummaryRow key={row.id} row={row} />
            ) : (
              <ShotRow key={row.id} row={row} />
            ),
          )}
        </div>
      </div>
    </section>
  )
}

function useActiveFeature(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '')

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(`feature-${id}`))
      .filter((el): el is HTMLElement => Boolean(el))
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = visible?.target.getAttribute('id')?.replace(/^feature-/, '')
        if (id) setActive(id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [ids])

  return active
}

function SummaryRow({ row }: { row: FeatureRow }) {
  const Icon = row.icon
  return (
    <article
      id={`feature-${row.id}`}
      aria-labelledby={`feature-title-${row.id}`}
      className="scroll-mt-24 rounded-2xl border border-border/60 bg-muted/20 p-6 sm:p-10"
    >
      <FeatureHeader row={row} Icon={Icon} />
      <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{row.body}</p>
      <FeatureBullets bullets={row.bullets} className="mt-8 border-t border-border/50 pt-6 sm:grid sm:grid-cols-3 sm:gap-6" />
    </article>
  )
}

function ShotRow({ row }: { row: FeatureRow }) {
  const Icon = row.icon
  return (
    <article
      id={`feature-${row.id}`}
      aria-labelledby={`feature-title-${row.id}`}
      className="flex scroll-mt-24 flex-col gap-8"
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
        <div>
          <FeatureHeader row={row} Icon={Icon} />
          <p className="mt-4 text-pretty text-muted-foreground">{row.body}</p>
        </div>
        <FeatureBullets bullets={row.bullets} className="lg:pt-10" />
      </div>
      <Screenshot shot={featureScreenshot(row.id)} />
    </article>
  )
}

function FeatureHeader({
  row,
  Icon,
}: {
  row: FeatureRow
  Icon: FeatureRow['icon']
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {row.eyebrow}
        </span>
      </div>
      <h3
        id={`feature-title-${row.id}`}
        className="mt-3 text-balance text-2xl font-semibold sm:text-3xl"
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
          <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-foreground/50" aria-hidden="true" />
          <span className="text-muted-foreground">{bullet}</span>
        </li>
      ))}
    </ul>
  )
}
