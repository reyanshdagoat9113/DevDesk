import * as React from 'react'
import { CheckCircle2, CircleAlert, CircleOff, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatusNoticeTone = 'success' | 'warning' | 'error' | 'info' | 'inactive'

export interface StatusNoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: StatusNoticeTone
  title?: React.ReactNode
  action?: React.ReactNode
}

const toneStyles: Record<StatusNoticeTone, string> = {
  success: 'border-status-success/30 bg-status-success/10 text-status-success',
  warning: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
  error: 'border-status-error/30 bg-status-error/10 text-status-error',
  info: 'border-status-info/30 bg-status-info/10 text-status-info',
  inactive: 'border-status-inactive/30 bg-status-inactive/10 text-status-inactive',
}

const toneIcons: Record<StatusNoticeTone, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  success: CheckCircle2,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
  inactive: CircleOff,
}

const StatusNotice = React.forwardRef<HTMLDivElement, StatusNoticeProps>(
  ({ className, tone = 'info', title, action, role, children, ...props }, ref) => {
    const Icon = toneIcons[tone]
    const titleId = React.useId()
    return (
      <div ref={ref} role={role ?? (tone === 'error' ? 'alert' : 'status')} aria-live={tone === 'error' ? undefined : 'polite'} aria-labelledby={title ? titleId : undefined} data-status={tone} data-slot="status-notice" className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-ui-body', toneStyles[tone], className)} {...props}>
        <Icon aria-hidden={true} className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          {title ? <p id={titleId} className="font-medium text-foreground">{title}</p> : null}
          {children ? <div className="text-foreground/80">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    )
  }
)
StatusNotice.displayName = 'StatusNotice'

export { StatusNotice }
