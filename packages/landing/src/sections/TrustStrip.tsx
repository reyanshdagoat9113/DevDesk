const claims = [
  { key: 'store', label: 'local-first', detail: 'sqlite on disk' },
  { key: 'account', label: 'account', detail: 'none' },
  { key: 'telemetry', label: 'telemetry', detail: 'off' },
  { key: 'license', label: 'license', detail: 'MIT' },
]

export function TrustStrip() {
  return (
    <section
      aria-label="How DevDesk handles your data"
      className="border-y border-border/40 bg-muted/15"
    >
      <ul className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-1 gap-y-3 px-4 py-5 font-mono text-xs sm:px-6 sm:text-[13px]">
        <li className="mr-3 flex items-center gap-2 text-foreground">
          <span className="size-2 rounded-full bg-prompt" aria-hidden="true" />
          <span>status</span>
        </li>
        {claims.map((claim, index) => (
          <li key={claim.key} className="flex items-center gap-3 text-muted-foreground">
            {index > 0 && (
              <span className="hidden text-border sm:inline" aria-hidden="true">
                |
              </span>
            )}
            <span>
              <span className="text-foreground/55">{claim.label}</span>
              <span className="mx-1.5 text-foreground/25">:</span>
              <span className="text-foreground">{claim.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
