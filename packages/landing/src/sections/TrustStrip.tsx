import { HardDrive, Scale, UserX, WifiOff } from 'lucide-react'

import { Separator } from '@/components/ui'

const claims = [
  { icon: HardDrive, label: 'Local-first', detail: 'Data lives in a local SQLite file' },
  { icon: UserX, label: 'No account', detail: 'Nothing to sign up for' },
  { icon: WifiOff, label: 'No telemetry', detail: 'No analytics, no background daemons' },
  { icon: Scale, label: 'MIT licensed', detail: 'Source is on GitHub' },
]

export function TrustStrip() {
  return (
    <section aria-label="What DevDesk does not do" className="border-y border-border/40 bg-muted/20">
      <ul className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-0 px-4 sm:px-6 lg:grid-cols-4">
        {claims.map(({ icon: Icon, label, detail }, index) => (
          <li key={label} className="relative flex items-start gap-3 px-2 py-6 sm:px-4 sm:py-8">
            {index > 0 && (
              <Separator
                orientation="vertical"
                className="absolute left-0 top-1/2 hidden h-10 -translate-y-1/2 lg:block"
              />
            )}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card shadow-sm">
              <Icon className="size-4 text-brand" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
