import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ui/ErrorState'

type AppErrorBoundaryProps = {
  children: ReactNode
  onReload?: () => void
}

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[renderer:error-boundary]', error, info.componentStack ?? '')
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const onReload = this.props.onReload ?? (() => window.location.reload())

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ErrorState
          title="DevDesk failed to render."
          description={this.state.error.message}
          onRetry={onReload}
          retryLabel="Reload"
        />
      </div>
    )
  }
}
