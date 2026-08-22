# UI libraries: shadcn/ui + Radix

The renderer uses shadcn-style wrappers on Radix primitives, styled with Tailwind.

CLI config: `components.json` (points at `apps/renderer`).

## Goals

- Radix for behavior and accessibility
- Tailwind + `cva` for variants
- Small, consistent component APIs
- No inline styles when a utility class exists

## Where things live

| Path | Role |
|------|------|
| `apps/renderer/app/components/ui/` | Button, Dialog, Tabs, Card, Command, … |
| `apps/renderer/lib/utils.ts` | `cn(...)` (`clsx` + `tailwind-merge`) |
| `apps/renderer/index.css` | Design tokens (light/dark), shared utilities |
| `apps/renderer/app/sections/` | Feature pages — compose primitives, do not restyle from scratch |

## Pattern

```tsx
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
```

Use `asChild` + Radix `Slot` when the wrapper should render as a child element.

## Notes

- Prefer composition over deep prop drilling.
- Keep new primitives in `components/ui`; keep product UI in `components/` or `sections/`.
- Match existing spacing, radius, and muted/border tokens — do not introduce a second palette.
