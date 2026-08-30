import { useEffect, useState, type ReactNode } from 'react'
import { clearLatestRuntimeError, subscribeRuntimeErrors, type RuntimeErrorInfo } from '../lib/rendererErrors'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'
import { Button } from './ui/Button'

export function RuntimeErrorBanner({ children }: { children: ReactNode }) {
  const [error, setError] = useState<RuntimeErrorInfo | null>(null)

  useEffect(() => subscribeRuntimeErrors(setError), [])

  return (
    <>
      {error ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center p-3">
          <Alert variant="destructive" className="pointer-events-auto max-w-2xl shadow-lg">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <p>{error.message}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearLatestRuntimeError()
                    setError(null)
                  }}
                >
                  Dismiss
                </Button>
                <Button type="button" size="sm" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {children}
    </>
  )
}
