import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border/60 bg-background/50',
        success: 'border-transparent bg-status-success/15 text-status-success',
        warning: 'border-transparent bg-status-warning/15 text-status-warning',
        info: 'border-transparent bg-status-info/15 text-status-info',
        inactive: 'border-transparent bg-status-inactive/15 text-status-inactive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

/**
 * A non-interactive status label for metadata such as state, type, or count.
 * Use Button for actions; Badge intentionally renders a span and has no
 * interactive focus styling.
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
