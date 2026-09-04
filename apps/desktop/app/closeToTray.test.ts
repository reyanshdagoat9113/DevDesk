import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  maybeShowTrayCloseHint,
  shouldHideToTray,
  shouldQuitWhenAllWindowsClosed,
} from './closeToTray'

describe('shouldHideToTray', () => {
  it.each([
    {
      name: 'quitting',
      options: { isQuitting: true, trayEnabled: true, platform: 'win32' as const },
      expected: false,
    },
    {
      name: 'tray off',
      options: { isQuitting: false, trayEnabled: false, platform: 'win32' as const },
      expected: false,
    },
    {
      name: 'darwin',
      options: { isQuitting: false, trayEnabled: true, platform: 'darwin' as const },
      expected: false,
    },
    {
      name: 'win32 tray on',
      options: { isQuitting: false, trayEnabled: true, platform: 'win32' as const },
      expected: true,
    },
    {
      name: 'linux tray on',
      options: { isQuitting: false, trayEnabled: true, platform: 'linux' as const },
      expected: true,
    },
  ])('$name → $expected', ({ options, expected }) => {
    expect(shouldHideToTray(options)).toBe(expected)
  })
})

describe('shouldQuitWhenAllWindowsClosed', () => {
  it.each([
    { platform: 'darwin' as const, trayEnabled: true, expected: false },
    { platform: 'darwin' as const, trayEnabled: false, expected: false },
    { platform: 'win32' as const, trayEnabled: true, expected: false },
    { platform: 'win32' as const, trayEnabled: false, expected: true },
    { platform: 'linux' as const, trayEnabled: true, expected: false },
    { platform: 'linux' as const, trayEnabled: false, expected: true },
  ])('$platform trayEnabled=$trayEnabled → $expected', ({ platform, trayEnabled, expected }) => {
    expect(shouldQuitWhenAllWindowsClosed({ platform, trayEnabled })).toBe(expected)
  })
})

describe('maybeShowTrayCloseHint', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `devdesk-close-to-tray-${randomUUID()}`)
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('shows a notification and writes the flag file the first time', async () => {
    const showNotification = vi.fn()

    const shown = await maybeShowTrayCloseHint({
      userDataPath: tmpDir,
      showNotification,
    })

    expect(shown).toBe(true)
    expect(showNotification).toHaveBeenCalledTimes(1)
    expect(showNotification).toHaveBeenCalledWith(
      'DevDesk is still running',
      'DevDesk was minimized to the system tray. Use Quit on the tray icon to exit completely.'
    )

    const flagPath = path.join(tmpDir, 'tray-close-hint-shown')
    expect(await readFile(flagPath, 'utf8')).toBe('1')
  })

  it('does not show the notification again after the flag is written', async () => {
    const showNotification = vi.fn()
    const options = { userDataPath: tmpDir, showNotification }

    expect(await maybeShowTrayCloseHint(options)).toBe(true)
    expect(await maybeShowTrayCloseHint(options)).toBe(false)

    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('does not write the flag file when showNotification throws', async () => {
    const showNotification = vi.fn(() => {
      throw new Error('notify failed')
    })

    await expect(
      maybeShowTrayCloseHint({
        userDataPath: tmpDir,
        showNotification,
      })
    ).rejects.toThrow('notify failed')

    const flagPath = path.join(tmpDir, 'tray-close-hint-shown')
    await expect(access(flagPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
