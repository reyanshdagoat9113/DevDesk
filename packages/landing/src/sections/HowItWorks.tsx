import { Badge, Card, CardContent } from '@/components/ui'
import { steps } from '@/config/content'

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="outline" className="mb-4">
          Get started
        </Badge>
        <h2
          id="how-it-works-heading"
          className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Three steps, then you are working
        </h2>
      </div>

      <ol className="relative mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
        {steps.map((step, index) => (
          <li key={step.n} className="relative">
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className="absolute left-[calc(50%+2rem)] right-[-1.5rem] top-10 hidden h-px bg-gradient-to-r from-border to-transparent md:block"
              />
            )}
            <Card className="h-full border-border/50 bg-card/70">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="flex size-10 items-center justify-center rounded-full border border-brand/25 bg-brand/10 font-mono text-sm font-semibold text-brand">
                  {String(step.n).padStart(2, '0')}
                </span>
                <h3 className="text-lg font-medium">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}
