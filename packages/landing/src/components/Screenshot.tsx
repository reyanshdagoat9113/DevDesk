import { ImageOff } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { SCREENSHOT_HEIGHT, SCREENSHOT_WIDTH, type Screenshot as ScreenshotMeta } from '@/config/screenshots'

type ScreenshotProps = {
  shot: ScreenshotMeta
  className?: string
  /** The hero image is above the fold and should not be lazy-loaded. */
  priority?: boolean
}

/**
 * Screenshot frame with a graceful fallback.
 *
 * Product screenshots are captured by hand (see scripts/capture-screenshot.ps1) and may
 * not exist yet. Rather than showing a broken image, the frame falls back to a labelled
 * placeholder at the exact capture aspect ratio, so the layout is identical either way.
 */
export function Screenshot({ shot, className, priority = false }: ScreenshotProps) {
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={cn(
        'glass-card overflow-hidden rounded-xl border shadow-sm',
        'aspect-[16/10]',
        className,
      )}
    >
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/30 p-6 text-center">
          <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{shot.capture}</p>
          <p className="font-mono text-xs text-muted-foreground">
            screenshots/{shot.file} · {SCREENSHOT_WIDTH}x{SCREENSHOT_HEIGHT}
          </p>
        </div>
      ) : (
        <img
          src={shot.src}
          alt={shot.alt}
          width={SCREENSHOT_WIDTH}
          height={SCREENSHOT_HEIGHT}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onError={() => setFailed(true)}
          className="size-full object-cover object-left-top"
        />
      )}
    </div>
  )
}
