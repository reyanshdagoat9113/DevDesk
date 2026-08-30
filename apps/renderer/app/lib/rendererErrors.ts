import { isRecoverableDockerErrorMessage, unwrapIpcErrorMessage } from './appShell'

export type RuntimeErrorInfo = {
  message: string
  details?: string
  source: 'error' | 'unhandledrejection'
}

type RuntimeErrorListener = (error: RuntimeErrorInfo | null) => void

let latestRuntimeError: RuntimeErrorInfo | null = null
const runtimeErrorListeners = new Set<RuntimeErrorListener>()
let uninstallWindowListeners: (() => void) | null = null

function toRawErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback
  }
  if (error === undefined || error === null) {
    return fallback
  }
  return String(error)
}

export function describeUnknownError(error: unknown, fallback: string): { message: string; details?: string } {
  const message = unwrapIpcErrorMessage(error, toRawErrorMessage(error, fallback))
  const details = error instanceof Error && error.stack ? error.stack : undefined
  return details ? { message, details } : { message }
}

function readRejectionReason(event: Event): unknown {
  if ('reason' in event) {
    return (event as { reason: unknown }).reason
  }
  return undefined
}

function notifyRuntimeErrorListeners(error: RuntimeErrorInfo | null) {
  for (const listener of [...runtimeErrorListeners]) {
    listener(error)
  }
}

function emitRuntimeError(error: RuntimeErrorInfo) {
  latestRuntimeError = error
  notifyRuntimeErrorListeners(error)
}

export function subscribeRuntimeErrors(listener: RuntimeErrorListener) {
  runtimeErrorListeners.add(listener)
  if (latestRuntimeError) {
    listener(latestRuntimeError)
  }
  return () => {
    runtimeErrorListeners.delete(listener)
  }
}

export function clearLatestRuntimeError() {
  latestRuntimeError = null
  notifyRuntimeErrorListeners(null)
}

export function renderBootstrapError(message: string, details?: string) {
  const root = document.getElementById('root')
  if (!root) {
    return
  }

  const page = document.createElement('div')
  page.style.cssText = 'min-height: 100vh; background: #09090b; color: #fafafa; padding: 32px; font-family: Inter, system-ui, sans-serif;'

  const card = document.createElement('div')
  card.style.cssText = 'max-width: 720px; margin: 48px auto; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; background: rgba(255,255,255,0.03); padding: 24px;'

  const kicker = document.createElement('p')
  kicker.style.cssText = 'margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.55);'
  kicker.textContent = 'Renderer Error'

  const heading = document.createElement('h1')
  heading.style.cssText = 'margin: 0 0 12px; font-size: 22px;'
  heading.textContent = 'DevDesk failed to render.'

  const summary = document.createElement('p')
  summary.style.cssText = 'margin: 0 0 16px; color: rgba(255,255,255,0.8);'
  summary.textContent = message

  card.append(kicker, heading, summary)

  if (details) {
    const pre = document.createElement('pre')
    pre.style.cssText = 'white-space: pre-wrap; word-break: break-word; font-size: 12px; color: rgba(255,255,255,0.72); background: rgba(0,0,0,0.22); border-radius: 12px; padding: 16px; margin: 0;'
    pre.textContent = details
    card.append(pre)
  }

  page.append(card)
  root.replaceChildren(page)
}

function handleWindowError(event: ErrorEvent) {
  const source = event.error instanceof Error ? event.error : event.error ?? event.message
  const { message, details } = describeUnknownError(source, event.message || 'Unknown renderer error')

  if (isRecoverableDockerErrorMessage(message)) {
    console.warn('[renderer:recoverable-docker-error]', message)
    event.preventDefault()
    return
  }

  console.error('[renderer:window-error]', message, details ?? '')
  emitRuntimeError({
    message,
    details,
    source: 'error',
  })
}

function handleUnhandledRejection(event: Event) {
  const reason = readRejectionReason(event)
  const { message, details } = describeUnknownError(reason, 'Unhandled promise rejection')

  if (isRecoverableDockerErrorMessage(message)) {
    console.warn('[renderer:recoverable-docker-error]', message)
    event.preventDefault()
    return
  }

  const logMessage = reason instanceof Error ? reason.message : String(reason ?? message)
  console.error('[renderer:unhandled-rejection]', logMessage, details ?? '')
  emitRuntimeError({
    message,
    details,
    source: 'unhandledrejection',
  })
}

export function installGlobalRuntimeErrorHandling() {
  if (uninstallWindowListeners) {
    return uninstallWindowListeners
  }

  window.addEventListener('error', handleWindowError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)

  uninstallWindowListeners = () => {
    window.removeEventListener('error', handleWindowError)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    uninstallWindowListeners = null
  }

  return uninstallWindowListeners
}

export function resetRuntimeErrorStateForTests() {
  latestRuntimeError = null
  runtimeErrorListeners.clear()
  uninstallWindowListeners?.()
}
