# UI Libraries: shadcn/ui + Radix UI

DevDesk uses shadcn/ui component patterns on top of Radix UI primitives.

## Goals
- Use Radix primitives for accessibility and behavior.
- Wrap primitives with Tailwind classes and cva variants.
- Keep component APIs small and consistent.

## Structure
- `apps/renderer/app/components/ui/` for shadcn-style wrappers (Button, Tabs, Card, Alert, Badge).
- `apps/renderer/lib/utils.ts` for the `cn(...)` helper using `clsx` + `tailwind-merge`.

## Component pattern
- Use `class-variance-authority` for variant and size styles.
- Export `...Variants` for reuse.
- Support `asChild` via Radix `Slot` when useful.

Example pattern:
```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva('base-classes', {
  variants: {
    variant: { default: 'bg-primary text-primary-foreground' },
    size: { default: 'h-10 px-4 py-2' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
```

## Notes
- Keep styles in Tailwind classes; avoid inline styles.
- Prefer composition over deep prop drilling.
