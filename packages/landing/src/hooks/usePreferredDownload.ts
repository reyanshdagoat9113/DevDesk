import { useEffect, useState } from 'react'

import { downloads, primaryDownload, type DownloadArtifact } from '@/config/site'

/**
 * Prefer the Linux artifact when the visitor is on a Linux desktop; otherwise
 * the Windows installer (the page's default). macOS has no build.
 */
export function usePreferredDownload(): DownloadArtifact | null {
  const [artifact, setArtifact] = useState<DownloadArtifact | null>(primaryDownload)

  useEffect(() => {
    const ua = navigator.userAgent
    const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua)
    if (!isLinux) return
    const linux = downloads.find((item) => item.platform === 'linux' && item.available)
    if (linux) setArtifact(linux)
  }, [])

  return artifact
}
