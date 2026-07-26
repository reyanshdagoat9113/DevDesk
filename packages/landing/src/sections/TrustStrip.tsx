import { HardDrive, Scale, UserX, WifiOff } from 'lucide-react'

const claims = [
  { icon: HardDrive, label: 'Local-first', detail: 'Data lives in a local SQLite file' },
  { icon: UserX, label: 'No account', detail: 'Nothing to sign up for' },
  { icon: WifiOff, label: 'No telemetry', detail: 'No analytics, no background daemons' },
  { icon: Scale, label: 'MIT licensed', detail: 'Source is on GitHub' },
]

export function TrustStrip() {
  return (
    <section
      aria-label="What DevDesk does not do"
      className="border-y border-border/50 bg-muted/20"
    >
      <ul className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
        {claims.map(({ icon: Icon, label, detail }) => (
          <li key={label} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
