import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'

function renderBootstrapError(message: string, details?: string) {
  const root = document.getElementById('root')
  if (!root) {
    return
  }

  root.innerHTML = `
    <div style="min-height: 100vh; background: #09090b; color: #fafafa; padding: 32px; font-family: Inter, system-ui, sans-serif;">
      <div style="max-width: 720px; margin: 48px auto; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; background: rgba(255,255,255,0.03); padding: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.55);">Renderer Error</p>
        <h1 style="margin: 0 0 12px; font-size: 22px;">DevDesk failed to render.</h1>
        <p style="margin: 0 0 16px; color: rgba(255,255,255,0.8);">${message}</p>
        ${details ? `<pre style="white-space: pre-wrap; word-break: break-word; font-size: 12px; color: rgba(255,255,255,0.72); background: rgba(0,0,0,0.22); border-radius: 12px; padding: 16px; margin: 0;">${details}</pre>` : ''}
      </div>
    </div>
  `
}

window.addEventListener('error', (event) => {
  const error = event.error instanceof Error ? event.error : null
  const message = error?.message ?? event.message ?? 'Unknown renderer error'
  const details = error?.stack ?? undefined

  console.error('[renderer:window-error]', message, details ?? '')
  renderBootstrapError(message, details)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason)
  const details = reason instanceof Error ? reason.stack : undefined

  console.error('[renderer:unhandled-rejection]', message, details ?? '')
  renderBootstrapError(message, details)
})

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error'
  const details = error instanceof Error ? error.stack : undefined
  console.error('[renderer:bootstrap-error]', message, details ?? '')
  renderBootstrapError(message, details)
}
