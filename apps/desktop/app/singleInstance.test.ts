import { describe, expect, it, vi } from 'vitest'

import { acquireSingleInstanceLock, focusExistingWindow, type FocusableWindow, type SingleInstanceApp } from './singleInstance'

function createFakeApp(lockGranted: boolean): SingleInstanceApp & {
  requestSingleInstanceLock: ReturnType<typeof vi.fn>
  quit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
} {
  return {
    requestSingleInstanceLock: vi.fn(() => lockGranted),
    quit: vi.fn(),
    on: vi.fn(),
  }
}

function createFakeWindow(overrides: Partial<FocusableWindow> = {}): FocusableWindow {
  return {
    isDestroyed: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    ...overrides,
  }
}

describe('acquireSingleInstanceLock', () => {
  it('quits and returns false when the lock is denied', () => {
    const electronApp = createFakeApp(false)
    const onSecondInstance = vi.fn()

    const acquired = acquireSingleInstanceLock(electronApp, onSecondInstance)

    expect(acquired).toBe(false)
    expect(electronApp.requestSingleInstanceLock).toHaveBeenCalledTimes(1)
    expect(electronApp.quit).toHaveBeenCalledTimes(1)
    expect(electronApp.on).not.toHaveBeenCalled()
  })

  it('registers second-instance and returns true when the lock is granted', () => {
    const electronApp = createFakeApp(true)
    const onSecondInstance = vi.fn()

    const acquired = acquireSingleInstanceLock(electronApp, onSecondInstance)

    expect(acquired).toBe(true)
    expect(electronApp.requestSingleInstanceLock).toHaveBeenCalledTimes(1)
    expect(electronApp.quit).not.toHaveBeenCalled()
    expect(electronApp.on).toHaveBeenCalledTimes(1)
    expect(electronApp.on).toHaveBeenCalledWith('second-instance', onSecondInstance)
  })

  it('invokes onSecondInstance when the registered listener fires', () => {
    const electronApp = createFakeApp(true)
    const onSecondInstance = vi.fn()

    acquireSingleInstanceLock(electronApp, onSecondInstance)

    const listener = electronApp.on.mock.calls[0]?.[1] as (() => void) | undefined
    expect(listener).toBe(onSecondInstance)
    listener?.()
    expect(onSecondInstance).toHaveBeenCalledTimes(1)
  })
})

describe('focusExistingWindow', () => {
  it('restores, shows, and focuses a hidden minimized window', () => {
    const window = createFakeWindow({
      isMinimized: () => true,
      isVisible: () => false,
    })

    const focused = focusExistingWindow([window])

    expect(focused).toBe(true)
    expect(window.restore).toHaveBeenCalledTimes(1)
    expect(window.show).toHaveBeenCalledTimes(1)
    expect(window.focus).toHaveBeenCalledTimes(1)
  })

  it('skips destroyed windows and focuses the next live window', () => {
    const destroyed = createFakeWindow({
      isDestroyed: () => true,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    })
    const live = createFakeWindow()

    const focused = focusExistingWindow([destroyed, live])

    expect(focused).toBe(true)
    expect(destroyed.restore).not.toHaveBeenCalled()
    expect(destroyed.show).not.toHaveBeenCalled()
    expect(destroyed.focus).not.toHaveBeenCalled()
    expect(live.focus).toHaveBeenCalledTimes(1)
  })

  it('returns false when there are no live windows', () => {
    expect(focusExistingWindow([])).toBe(false)

    const destroyed = createFakeWindow({
      isDestroyed: () => true,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    })

    expect(focusExistingWindow([destroyed])).toBe(false)
    expect(destroyed.restore).not.toHaveBeenCalled()
    expect(destroyed.show).not.toHaveBeenCalled()
    expect(destroyed.focus).not.toHaveBeenCalled()
  })
})
