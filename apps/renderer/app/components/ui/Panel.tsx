import * as React from 'react'
import { cn } from '@/lib/utils'

const Panel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="panel"
      className={cn('rounded-xl border border-surface-border bg-surface text-foreground shadow-sm', className)}
      {...props}
    />
  )
)
Panel.displayName = 'Panel'

const PanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="panel-header" className={cn('flex flex-col gap-1.5 border-b border-surface-border px-5 py-4', className)} {...props} />
  )
)
PanelHeader.displayName = 'PanelHeader'

const PanelTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} data-slot="panel-title" className={cn('text-ui-section text-foreground', className)} {...props} />
  )
)
PanelTitle.displayName = 'PanelTitle'

const PanelDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="panel-description" className={cn('text-ui-body text-muted-foreground', className)} {...props} />
  )
)
PanelDescription.displayName = 'PanelDescription'

const PanelContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="panel-content" className={cn('p-5', className)} {...props} />
  )
)
PanelContent.displayName = 'PanelContent'

const PanelFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="panel-footer" className={cn('flex items-center gap-2 border-t border-surface-border px-5 py-4', className)} {...props} />
  )
)
PanelFooter.displayName = 'PanelFooter'

export { Panel, PanelHeader, PanelFooter, PanelTitle, PanelDescription, PanelContent }
