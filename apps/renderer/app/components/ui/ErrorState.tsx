import * as React from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ className, title, description, action, onRetry, retryLabel = 'Try again', ...props }, ref) => {
    const titleId = React.useId()
    return (
      <div ref={ref} role="alert" aria-labelledby={titleId} data-slot="error-state" className={cn('flex min-h-40 flex-col items-center justify-center gap-3 px-5 py-8 text-center', className)} {...props}>
        <CircleAlert aria-hidden="true" className="h-5 w-5 text-status-error" />
        <div className="space-y-1">
          <h3 id={titleId} className="text-ui-section text-foreground">{title}</h3>
          {description ? <p className="max-w-md text-ui-body text-muted-foreground">{description}</p> : null}
        </div>
        {action || onRetry ? <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{action}{onRetry ? <Button type="button" size="sm" variant="outline" onClick={onRetry}>{retryLabel}</Button> : null}</div> : null}
      </div>
    )
  }
)
ErrorState.displayName = 'ErrorState'

export { ErrorState }
