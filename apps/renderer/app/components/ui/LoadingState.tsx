import * as React from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LoadingStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  label?: string
  description?: React.ReactNode
  size?: 'sm' | 'default' | 'lg'
}

const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, label = 'Loading', description, size = 'default', ...props }, ref) => (
    <div ref={ref} role="status" aria-live="polite" aria-label={label} data-slot="loading-state" className={cn('flex flex-col items-center justify-center gap-2 px-5 py-8 text-center text-muted-foreground', className)} {...props}>
      <LoaderCircle aria-hidden="true" className={cn('animate-spin text-primary', size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-7 w-7' : 'h-5 w-5')} />
      <span className="sr-only">{label}</span>
      {description ? <p className="text-ui-body">{description}</p> : null}
    </div>
  )
)
LoadingState.displayName = 'LoadingState'

export { LoadingState }
