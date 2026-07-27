import { useState } from 'react'

import { ProductMock } from '@/components/ProductMock'
import { ScreenshotLightbox } from '@/components/ScreenshotLightbox'
import { WindowFrame } from '@/components/WindowFrame'
import {
  SCREENSHOT_HEIGHT,
  SCREENSHOT_WIDTH,
  type Screenshot as ScreenshotMeta,
} from '@/config/screenshots'

type ScreenshotProps = {
  shot: ScreenshotMeta
  className?: string
  /** The hero image is above the fold and should not be lazy-loaded. */
  priority?: boolean
}

/**
 * Product visual: prefers a real 1600×1000 capture when present, otherwise a stylised
 * in-app mock so the page never looks empty. Both sit inside the same window chrome.
 * Click / keyboard opens a full-size lightbox.
 */
export function Screenshot({ shot, className, priority = false }: ScreenshotProps) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const title = `DevDesk — ${shot.label}`

  // When the capture fails there is no lightbox trigger, so the frame itself
  // has to carry the caller's layout classes.
  const frame = (
    <WindowFrame title={title} className={failed ? className : undefined}>
      {failed ? (
        <ProductMock id={shot.id} label={shot.alt} className="size-full" />
      ) : (
        <img
          src={shot.src}
          alt={shot.alt}
          width={SCREENSHOT_WIDTH}
          height={SCREENSHOT_HEIGHT}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onError={() => setFailed(true)}
          className="size-full object-contain object-left-top"
        />
      )}
    </WindowFrame>
  )

  if (failed) {
    return frame
  }

  return (
    <ScreenshotLightbox shot={shot} open={open} onOpenChange={setOpen} className={className}>
      {frame}
    </ScreenshotLightbox>
  )
}
