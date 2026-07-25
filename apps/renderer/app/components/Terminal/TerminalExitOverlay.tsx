import { Button } from '../ui/Button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card'

interface TerminalExitOverlayProps {
  exitCode?: number | null
  error?: string | null
  onDismiss?: () => void
}

export function TerminalExitOverlay({ exitCode, error, onDismiss }: TerminalExitOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-80 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {error ? 'Terminal Error' : 'Terminal Exited'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {exitCode !== undefined && exitCode !== null && (
            <p className="text-muted-foreground">
              Exit code: <span className="font-mono font-medium">{exitCode}</span>
            </p>
          )}
          {error && (
            <p className="text-destructive text-xs font-mono break-all">{error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" className="w-full" onClick={onDismiss}>
            Close
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
