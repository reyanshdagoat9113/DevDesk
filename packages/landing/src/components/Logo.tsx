import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Vector logo mark, traced from apps/renderer/assets/devdesk-logo-top-left-transparent.png.
 * Kept in sync with public/logo-mark.svg (that copy exists for favicons, OG art, and
 * anywhere an <img> is needed).
 *
 * The strokes inherit `currentColor`, so a single component covers the light and dark
 * themes; only the cursor block keeps the fixed brand green.
 */
export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="26 24 208 208"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('size-8', className)}
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M48 44h92" />
        <path d="M140 44c48 0 72 38 72 84s-24 84-72 84H48" />
        <path d="M48 212v-34" />
        <path d="M48 78l46 38-46 38" />
      </g>
      <rect x={96} y={131} width={44} height={22} rx={7} fill="#33d02b" />
    </svg>
  )
}

type WordmarkProps = {
  className?: string
  /** Renders the mark inside the product icon tile, matching the installed app. */
  tile?: boolean
}

/**
 * Mark plus "DevDesk" set in the site's own type, rather than baked-in letterform
 * outlines: the text stays selectable, accessible, and theme-aware.
 */
export function Wordmark({ className, tile = false }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {tile ? (
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#0b1128] text-[#e1ebf4]">
          <LogoMark className="size-7" />
        </span>
      ) : (
        <LogoMark className="size-8" />
      )}
      <span className="text-lg font-semibold leading-none tracking-[-0.03em]">DevDesk</span>
    </span>
  )
}
