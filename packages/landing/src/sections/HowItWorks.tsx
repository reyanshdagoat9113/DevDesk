import { SectionPath } from '@/components/Prompt'
import { steps } from '@/config/content'

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="max-w-2xl">
        <SectionPath segment="start" />
        <h2
          id="how-it-works-heading"
          className="text-balance text-3xl font-semibold sm:text-4xl"
        >
          Three steps, then you are working
        </h2>
      </div>

      <ol className="mt-12 grid gap-0 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.n}
            className="relative border-t border-border/60 py-8 md:border-l md:border-t-0 md:px-8 md:py-0 md:first:border-l-0 md:first:pl-0"
          >
            <p className="font-mono text-xs text-muted-foreground">
              {index > 0 && (
                <span className="mr-2 hidden text-foreground/30 md:inline" aria-hidden="true">
                  &&
                </span>
              )}
              $ {step.title.toLowerCase()}
            </p>
            <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
