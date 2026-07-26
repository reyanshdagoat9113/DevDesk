import { Badge, Card, CardContent } from '@/components/ui'
import { secondaryFeatures } from '@/config/content'

export function SecondaryFeatures() {
  return (
    <section
      aria-labelledby="more-features"
      className="border-y border-border/40 bg-muted/15"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-4">
            Also included
          </Badge>
          <h2
            id="more-features"
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            And the small things you end up needing
          </h2>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryFeatures.map(({ title, body, icon: Icon }) => (
            <li key={title}>
              <Card className="h-full border-border/50 bg-card/80 transition-colors hover:border-brand/30 hover:bg-card">
                <CardContent className="flex h-full flex-col gap-3 p-5 sm:p-6">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background">
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                  </span>
                  <h3 className="font-medium leading-snug">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
