import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Expand, X } from 'lucide-react'

import { WindowFrame } from '@/components/WindowFrame'
import { cn } from '@/lib/utils'
import {
  SCREENSHOT_HEIGHT,
  SCREENSHOT_WIDTH,
  type Screenshot as ScreenshotMeta,
} from '@/config/screenshots'

type ScreenshotLightboxProps = {
  shot: ScreenshotMeta
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preview node shown in-page (already framed). */
  children: ReactNode
  className?: string
}

/**
 * In-page screenshot preview that opens a large modal on click / Enter / Space.
 * PNGs are shown as-is — no crop or color filters.
 * Width is derived from viewport height so the 16:10 body never clips.
 * Below sm, the modal image is natural-width and pannable.
 */
export function ScreenshotLightbox({
  shot,
  open,
  onOpenChange,
  children,
  className,
}: ScreenshotLightboxProps) {
  const title = `DevDesk — ${shot.label}`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            'group/shot relative block w-full cursor-zoom-in rounded-lg text-left',
            'focus-brand outline-none',
            className,
          )}
          aria-label={`View larger: ${shot.alt}`}
        >
          {children}
          <span
            className={cn(
              'pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5',
              'rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] font-medium',
              'text-muted-foreground shadow-sm backdrop-blur-sm',
              'opacity-0 transition-opacity group-hover/shot:opacity-100 group-focus-visible/shot:opacity-100',
              '[@media(hover:none)]:opacity-100',
            )}
            aria-hidden="true"
          >
            <Expand className="size-3" />
            Expand
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none',
            // 108px ≈ title row + caption chrome + footer hint; keeps 16:10 body inside 92vh
            'w-[min(96vw,1600px,calc((92vh-108px)*1.6))]',
            'data-[state=open]:animate-fade-in',
          )}
          aria-describedby={undefined}
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
            <Dialog.Title className="truncate text-sm font-medium text-white/90">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-md',
                'bg-white/10 text-white/90 transition-colors hover:bg-white/15',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
              aria-label="Close screenshot"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <WindowFrame
            title={title}
            bodyClassName="max-sm:aspect-auto max-sm:max-h-[min(70vh,700px)] max-sm:overflow-auto"
          >
            <img
              src={shot.src}
              alt={shot.alt}
              width={SCREENSHOT_WIDTH}
              height={SCREENSHOT_HEIGHT}
              className={cn(
                'bg-[#0c0c0e]',
                'max-sm:h-auto max-sm:w-[1600px] max-sm:max-w-none',
                'sm:size-full sm:object-contain sm:object-left-top',
              )}
              decoding="async"
            />
          </WindowFrame>

          <p className="mt-2 text-center text-xs text-white/50 max-sm:hidden">
            Press Esc or click outside to close
          </p>
          <p className="mt-2 text-center text-xs text-white/50 sm:hidden">
            Drag to pan · tap outside to close
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
