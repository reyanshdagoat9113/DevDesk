import { Card, CardContent } from '@/components/ui'
import { secondaryFeatures } from '@/config/content'

export function SecondaryFeatures() {
  return (
    <section aria-labelledby="more-features" className="border-t border-border/50 bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <h2 id="more-features" className="text-3xl font-semibold tracking-tight md:text-4xl">
          And the small things you end up needing
        </h2>

        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {secondaryFeatures.map(({ title, body, icon: Icon }) => (
            <li key={title}>
              <Card className="h-full hover-glow">
                <CardContent className="flex h-full flex-col gap-2 p-6">
                  <Icon className="size-4 text-brand" aria-hidden="true" />
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
