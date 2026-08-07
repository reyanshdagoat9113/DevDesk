import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, title, description, icon, action, ...props }, ref) => (
    <div ref={ref} data-slot="empty-state" className={cn('flex min-h-40 flex-col items-center justify-center gap-3 px-5 py-8 text-center', className)} {...props}>
      {icon ? <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface-muted text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <h3 className="text-ui-section text-foreground">{title}</h3>
        {description ? <p className="max-w-md text-ui-body text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
)
EmptyState.displayName = 'EmptyState'

export { EmptyState }
