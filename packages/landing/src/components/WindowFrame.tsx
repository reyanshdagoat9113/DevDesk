import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type WindowFrameProps = {
  children: ReactNode
  className?: string
  /** Optional title shown in the chrome bar. */
  title?: string
}

/**
 * Desktop-app chrome around product imagery / mocks.
 * Windows-style caption controls (not macOS traffic lights) — DevDesk ships Win + Linux only.
 */
export function WindowFrame({ children, className, title = 'DevDesk' }: WindowFrameProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border/60 bg-card shadow-2xl shadow-black/20',
        'ring-1 ring-black/5 dark:shadow-black/60 dark:ring-white/5',
        className,
      )}
    >
      <div className="flex h-9 items-center border-b border-border/50 bg-muted/40 pl-3">
        <div className="min-w-0 flex-1">
          <span className="truncate text-[11px] font-medium text-muted-foreground">{title}</span>
        </div>
        {/* Windows caption buttons — decorative only */}
        <div className="flex h-full shrink-0" aria-hidden="true">
          <span className="flex h-full w-11 items-center justify-center text-muted-foreground/80">
            <span className="block w-2.5 border-t border-current" />
          </span>
          <span className="flex h-full w-11 items-center justify-center text-muted-foreground/80">
            <span className="size-2.5 border border-current" />
          </span>
          <span className="flex h-full w-11 items-center justify-center text-muted-foreground/80">
            <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.25">
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </span>
        </div>
      </div>
      <div className="aspect-[16/10]">{children}</div>
    </div>
  )
}
