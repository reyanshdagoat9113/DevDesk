import { describe, expect, it } from 'vitest'

describe('normalize store helpers', () => {
  it('parses json array from string', async () => {
    const { parseJsonArray } = await import('./normalize')

    expect(parseJsonArray(null)).toEqual([])
    expect(parseJsonArray(undefined)).toEqual([])
    expect(parseJsonArray('')).toEqual([])
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b'])
    expect(parseJsonArray('["a","","b"]')).toEqual(['a', 'b'])
    expect(parseJsonArray('[1,2]')).toEqual([])
    expect(parseJsonArray('not-json')).toEqual([])
  })

  it('parses command variables from string', async () => {
    const { parseVariables } = await import('./normalize')

    expect(parseVariables(null)).toBeUndefined()
    expect(parseVariables(undefined)).toBeUndefined()
    expect(parseVariables('')).toBeUndefined()
    expect(parseVariables('[{"name":"version","required":true}]')).toEqual([
      { name: 'version', required: true },
    ])
    expect(parseVariables('[{"name":"msg","required":false,"default":"hi"}]')).toEqual([
      { name: 'msg', required: false, default: 'hi' },
    ])
    expect(parseVariables('["not-an-object"]')).toEqual([])
    expect(parseVariables('not-json')).toBeUndefined()
    expect(parseVariables('[{"name":"x"}]')).toEqual([])
  })

  it('parses chain steps from json string', async () => {
    const { parseChainSteps } = await import('./normalize')

    expect(parseChainSteps(null)).toEqual([])
    expect(parseChainSteps('[]')).toEqual([])
    expect(parseChainSteps('[{"id":"s1","commandId":"c1"}]')).toEqual([
      { id: 's1', commandId: 'c1', variables: undefined, delayMs: undefined },
    ])
    expect(parseChainSteps('[{"id":"s1","commandId":"c1","variables":{"v":"x"}}]')).toEqual([
      { id: 's1', commandId: 'c1', variables: { v: 'x' }, delayMs: undefined },
    ])
    expect(parseChainSteps('[{"id":"s1","commandId":"c1","delayMs":500}]')).toEqual([
      { id: 's1', commandId: 'c1', variables: undefined, delayMs: 500 },
    ])
    expect(parseChainSteps('[{"id":"s1","commandId":"c1","delayMs":-5}]')).toEqual([
      { id: 's1', commandId: 'c1', variables: undefined, delayMs: undefined },
    ])
    expect(parseChainSteps('[{"id":"s1"}]')).toEqual([])
    expect(parseChainSteps('not-json')).toEqual([])
  })

  it('normalizes valid projects from array', async () => {
    const { normalizeProjects } = await import('./normalize')

    expect(normalizeProjects(null)).toEqual([])
    expect(normalizeProjects([])).toEqual([])
    expect(normalizeProjects([{ non: 'sense' }])).toEqual([])

    const projects = normalizeProjects([
      {
        id: 'p1',
        path: '/a/b',
        name: 'App',
        type: 'node',
        icon: 'box',
        linkedContainerNames: ['c1'],
      },
    ])
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({ id: 'p1', name: 'App', type: 'node' })
    expect(projects[0].linkedContainerNames).toEqual(['c1'])
  })

  it('rejects projects with invalid types', async () => {
    const { normalizeProjects } = await import('./normalize')

    const projects = normalizeProjects([
      { id: 'p1', path: '/a', name: 'A', type: 'java', icon: 'box' },
    ])
    expect(projects).toEqual([])
  })

  it('normalizes chains from array', async () => {
    const { normalizeChains } = await import('./normalize')

    expect(normalizeChains(null)).toEqual([])
    expect(normalizeChains([])).toEqual([])

    const chains = normalizeChains([
      {
        id: 'c1',
        name: 'Deploy',
        description: 'Deploy to prod',
        projectId: 'p1',
        steps: [{ id: 's1', commandId: 'cmd1' }],
        stopOnFailure: false,
        parallel: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ])
    expect(chains).toHaveLength(1)
    expect(chains[0]).toMatchObject({
      id: 'c1',
      name: 'Deploy',
      stopOnFailure: false,
      parallel: true,
    })
    expect(chains[0].steps).toHaveLength(1)
  })

  it('defaults chain dates when missing', async () => {
    const { normalizeChains } = await import('./normalize')

    const [chain] = normalizeChains([{ id: 'c1', name: 'Build', steps: [] }])
    expect(chain.createdAt).toBeTruthy()
    expect(chain.updatedAt).toBeTruthy()
  })

  it('normalizes triggers from array', async () => {
    const { normalizeTriggers } = await import('./normalize')

    expect(normalizeTriggers(null)).toEqual([])

    const triggers = normalizeTriggers([
      {
        id: 't1',
        name: 'On Open',
        chainId: 'c1',
        event: 'onProjectOpen',
        enabled: true,
        requireConfirmation: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])
    expect(triggers).toHaveLength(1)
    expect(triggers[0]).toMatchObject({ id: 't1', name: 'On Open', event: 'onProjectOpen' })
  })

  it('rejects triggers with invalid events', async () => {
    const { normalizeTriggers } = await import('./normalize')

    const triggers = normalizeTriggers([
      { id: 't1', name: 'Bad', chainId: 'c1', event: 'invalidEvent' },
    ])
    expect(triggers).toEqual([])
  })

  it('normalizes notes from a record', async () => {
    const { normalizeNotes } = await import('./normalize')

    expect(normalizeNotes(null)).toEqual({})
    expect(normalizeNotes({})).toEqual({})

    const notes = normalizeNotes({
      'p1': { setupSteps: 'npm install', todos: 'fix bug', reminders: 'deploy' },
    })
    expect(notes.p1.setupSteps).toBe('npm install')
    expect(notes.p1.todos).toBe('fix bug')
    expect(notes.p1.reminders).toBe('deploy')
  })

  it('merges legacy ports/urls into setupSteps', async () => {
    const { normalizeNotes } = await import('./normalize')

    const notes = normalizeNotes({
      'p1': { ports: ':3000', urls: 'http://localhost' },
    })
    expect(notes.p1.setupSteps).toContain('Ports:')
    expect(notes.p1.setupSteps).toContain(':3000')
    expect(notes.p1.setupSteps).toContain('URLs:')
    expect(notes.p1.setupSteps).toContain('http://localhost')
  })

  it('normalizes a full store record', async () => {
    const { normalizeStore } = await import('./normalize')

    const store = normalizeStore(null)
    expect(store.version).toBe(4)
    expect(store.projects).toEqual([])
    expect(store.commands).toEqual([])
    expect(store.chains).toEqual([])
    expect(store.triggers).toEqual([])
    expect(store.runHistory).toEqual([])
    expect(store.notes).toEqual({})
  })

  it('preserves valid engine index and search session data', async () => {
    const { normalizeStore } = await import('./normalize')

    const store = normalizeStore({
      version: 4,
      projects: [],
      commands: [],
      chains: [],
      triggers: [],
      runHistory: [],
      notes: {},
      preferences: {},
      engineIndexes: {
        'p1': { projectId: 'p1', dbPath: '/tmp/p1.sqlite', lastIndexed: '2026-01-01', fileCount: 10 },
      },
      engineSearchSessions: {
        'p1': {
          projectId: 'p1',
          query: 'needle',
          regex: false,
          updatedAt: '2026-01-01',
          result: { ok: true, query: 'needle', totalMatches: 1, durationMs: 5, results: [] },
        },
      },
    })

    expect(store.engineIndexes?.p1?.fileCount).toBe(10)
    expect(store.engineSearchSessions?.p1?.query).toBe('needle')
    expect(store.engineSearchSessions?.p1?.result.ok).toBe(true)
  })
})
