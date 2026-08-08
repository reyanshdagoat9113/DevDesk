import { useEffect, useRef } from 'react'

export const GIT_REFRESH_INTERVAL_MS = 30_000

/**
 * Runs an async refresh immediately and at a fixed cadence without allowing
 * slow requests to overlap. The timer is released when the owning view unmounts.
 */
export function useAutoRefresh(refresh: () => Promise<unknown>, intervalMs = GIT_REFRESH_INTERVAL_MS) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    let disposed = false
    let isRefreshing = false

    const runRefresh = () => {
      if (disposed || isRefreshing) {
        return
      }

      isRefreshing = true
      void refreshRef.current()
        .catch(() => undefined)
        .finally(() => {
          isRefreshing = false
        })
    }

    runRefresh()
    const intervalId = window.setInterval(runRefresh, intervalMs)
    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [intervalMs])
}
