import { useState } from 'react'

import { ProductMock } from '@/components/ProductMock'
import { WindowFrame } from '@/components/WindowFrame'
import { cn } from '@/lib/utils'
import { SCREENSHOT_HEIGHT, SCREENSHOT_WIDTH, type Screenshot as ScreenshotMeta } from '@/config/screenshots'

type ScreenshotProps = {
  shot: ScreenshotMeta
  className?: string
  /** The hero image is above the fold and should not be lazy-loaded. */
  priority?: boolean
}

/**
 * Product visual: prefers a real 1600×1000 capture when present, otherwise a stylised
 * in-app mock so the page never looks empty. Both sit inside the same window chrome.
 */
export function Screenshot({ shot, className, priority = false }: ScreenshotProps) {
  const [failed, setFailed] = useState(false)
  const title = `DevDesk — ${shot.id}`

  return (
    <WindowFrame title={title} className={cn(className)}>
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
          className="size-full object-cover object-left-top"
        />
      )}
    </WindowFrame>
  )
}
