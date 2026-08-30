import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installGlobalRuntimeErrorHandling,
  renderBootstrapError,
  resetRuntimeErrorStateForTests,
  subscribeRuntimeErrors,
} from './rendererErrors'

const XSS_MARKUP = '<img src=x onerror="alert(1)">'
const PRE_BREAKOUT = `</pre>${XSS_MARKUP}`

function ensureRoot() {
  let root = document.getElementById('root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)
  }
  return root
}

function dispatchUnhandledRejection(reason: unknown) {
  const event = new Event('unhandledrejection', { cancelable: true }) as Event & { reason: unknown }
  event.reason = reason
  window.dispatchEvent(event)
  return event
}

function dispatchWindowError(error: unknown, message = 'Unknown renderer error') {
  const event = new ErrorEvent('error', {
    cancelable: true,
    message: error instanceof Error ? error.message : message,
    error,
  })
  window.dispatchEvent(event)
  return event
}

describe('rendererErrors', () => {
  beforeEach(() => {
    ensureRoot()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    resetRuntimeErrorStateForTests()
    document.getElementById('root')?.remove()
  })

  it('renders the bootstrap screen with text content instead of HTML', () => {
    const root = ensureRoot()
    renderBootstrapError(XSS_MARKUP, PRE_BREAKOUT)

    expect(root.querySelector('img')).toBeNull()
    expect(root.getElementsByTagName('pre')).toHaveLength(1)
    expect(root.textContent).toContain('Renderer Error')
    expect(root.textContent).toContain('DevDesk failed to render.')
    expect(root.textContent).toContain(XSS_MARKUP)
    expect(root.textContent).toContain(PRE_BREAKOUT)
    expect(Array.from(root.children).every((child) => child instanceof HTMLElement)).toBe(true)
    expect(root.childElementCount).toBeGreaterThan(0)
  })

  it('does not wipe a mounted root when an unhandled rejection fires', () => {
    const root = ensureRoot()
    const sentinel = document.createElement('div')
    sentinel.textContent = 'app-alive'
    root.append(sentinel)
    const htmlBefore = root.innerHTML

    installGlobalRuntimeErrorHandling()
    dispatchUnhandledRejection(new Error('late ipc failure'))

    expect(root.contains(sentinel)).toBe(true)
    expect(root.innerHTML).toBe(htmlBefore)
    expect(root.textContent).toContain('app-alive')
  })

  it('does not wipe a mounted root when a window error fires', () => {
    const root = ensureRoot()
    const sentinel = document.createElement('div')
    sentinel.textContent = 'app-alive'
    root.append(sentinel)
    const htmlBefore = root.innerHTML

    installGlobalRuntimeErrorHandling()
    dispatchWindowError(new Error('late window error'))

    expect(root.contains(sentinel)).toBe(true)
    expect(root.innerHTML).toBe(htmlBefore)
    expect(root.textContent).toContain('app-alive')
  })

  it('swallows recoverable docker rejections without notifying subscribers', () => {
    const listener = vi.fn()
    subscribeRuntimeErrors(listener)
    installGlobalRuntimeErrorHandling()

    const event = dispatchUnhandledRejection(new Error('Cannot connect to the docker daemon'))

    expect(event.defaultPrevented).toBe(true)
    expect(console.warn).toHaveBeenCalledWith(
      '[renderer:recoverable-docker-error]',
      'Cannot connect to the docker daemon',
    )
    expect(listener).not.toHaveBeenCalled()
  })

  it('swallows recoverable docker window errors without notifying subscribers', () => {
    const listener = vi.fn()
    subscribeRuntimeErrors(listener)
    installGlobalRuntimeErrorHandling()

    const event = dispatchWindowError(new Error('Docker Desktop daemon is not running'))

    expect(event.defaultPrevented).toBe(true)
    expect(listener).not.toHaveBeenCalled()
  })

  it('emits non-docker rejections to subscribers', () => {
    const listener = vi.fn()
    subscribeRuntimeErrors(listener)
    installGlobalRuntimeErrorHandling()

    dispatchUnhandledRejection(new Error('late ipc failure'))

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'late ipc failure',
        source: 'unhandledrejection',
      }),
    )
  })

  it('emits window errors to subscribers with unwrapped IPC messages', () => {
    const listener = vi.fn()
    subscribeRuntimeErrors(listener)
    installGlobalRuntimeErrorHandling()

    dispatchWindowError(new Error("Error invoking remote method 'git:status': Error: repo missing"))

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'repo missing',
        source: 'error',
      }),
    )
  })
})
