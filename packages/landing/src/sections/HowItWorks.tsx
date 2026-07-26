import { steps } from '@/config/content'

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-20">
      <h2 id="how-it-works" className="text-3xl font-semibold tracking-tight md:text-4xl">
        Three steps, then you are working
      </h2>

      <ol className="mt-10 grid gap-8 md:grid-cols-3">
        {steps.map((step) => (
          <li key={step.n} className="flex flex-col gap-3 border-t border-border pt-6">
            <span className="font-mono text-sm text-brand">{String(step.n).padStart(2, '0')}</span>
            <h3 className="text-lg font-medium">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
