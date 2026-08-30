import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'
import { AppErrorBoundary } from './app/components/AppErrorBoundary'
import { RuntimeErrorBanner } from './app/components/RuntimeErrorBanner'
import { describeUnknownError, installGlobalRuntimeErrorHandling, renderBootstrapError } from './app/lib/rendererErrors'

installGlobalRuntimeErrorHandling()
try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RuntimeErrorBanner>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </RuntimeErrorBanner>
    </StrictMode>,
  )
} catch (error) {
  const { message, details } = describeUnknownError(error, 'Unknown bootstrap error')
  console.error('[renderer:bootstrap-error]', message, details ?? '')
  renderBootstrapError(message, details)
}
