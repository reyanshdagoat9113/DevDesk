import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: () => '/mock/user/data',
  },
}))

describe('shared store utilities', () => {
  it('parses boolean values from numbers and strings', async () => {
    const { parseBoolean } = await import('./shared')

    expect(parseBoolean(1)).toBe(true)
    expect(parseBoolean(0)).toBe(false)
    expect(parseBoolean('1')).toBe(true)
    expect(parseBoolean('true')).toBe(true)
    expect(parseBoolean('TRUE')).toBe(true)
    expect(parseBoolean('0')).toBe(false)
    expect(parseBoolean('false')).toBe(false)
    expect(parseBoolean(null)).toBe(false)
    expect(parseBoolean(undefined)).toBe(false)
    expect(parseBoolean(true)).toBe(true)
    expect(parseBoolean(false)).toBe(false)
  })

  it('creates default preferences per platform', async () => {
    const { createDefaultPreferences } = await import('./shared')

    const prefs = createDefaultPreferences()
    expect(prefs.editor.id).toBeTruthy()
    expect(prefs.terminal.id).toBeTruthy()
  })

  it('creates default store with correct version and empty collections', async () => {
    const { createDefaultStore } = await import('./shared')

    const store = createDefaultStore()
    expect(store.version).toBe(5)
    expect(store.projects).toEqual([])
    expect(store.commands).toEqual([])
    expect(store.chains).toEqual([])
    expect(store.triggers).toEqual([])
    expect(store.runHistory).toEqual([])
    expect(store.notes).toEqual({})
    expect(store.bugReports).toEqual([])
    expect(store.preferences.editor.id).toBeTruthy()
    expect(store.preferences.terminal.id).toBeTruthy()
  })

  it('exports VALID_PROJECT_TYPES', async () => {
    const { VALID_PROJECT_TYPES } = await import('./shared')
    expect(VALID_PROJECT_TYPES.has('node')).toBe(true)
    expect(VALID_PROJECT_TYPES.has('python')).toBe(true)
    expect(VALID_PROJECT_TYPES.has('rust')).toBe(true)
    expect(VALID_PROJECT_TYPES.has('go')).toBe(true)
    expect(VALID_PROJECT_TYPES.has('unknown')).toBe(true)
    expect(VALID_PROJECT_TYPES.has('java')).toBe(false)
  })

  it('exports VALID_TRIGGER_EVENTS', async () => {
    const { VALID_TRIGGER_EVENTS } = await import('./shared')
    expect(VALID_TRIGGER_EVENTS.has('onProjectOpen')).toBe(true)
    expect(VALID_TRIGGER_EVENTS.has('afterContainerStart')).toBe(true)
    expect(VALID_TRIGGER_EVENTS.has('onStartup')).toBe(true)
    expect(VALID_TRIGGER_EVENTS.has('onFileSave')).toBe(false)
  })

  it('computes db and store paths from userData', async () => {
    const { getDbPath, getStorePath } = await import('./shared')

    expect(getDbPath()).toContain('devdesk.db')
    expect(getStorePath()).toContain('devdesk-store.json')
  })
})
