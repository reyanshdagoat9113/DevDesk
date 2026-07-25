import type { ElectronAPI } from '../app/types/electron'

type Handler = (...args: unknown[]) => void

function rejected(name: string) {
  return async (..._args: unknown[]) => {
    throw new Error(`electronAPI.${name} not stubbed in this test`)
  }
}

/**
 * Build a typed electronAPI fake. Unstubbed methods reject by default.
 * Subscription helpers capture handlers and return unsubscribe functions.
 */
export function createElectronApiFake(
  overrides: Partial<ElectronAPI> & { llm?: Partial<ElectronAPI['llm']> } = {},
): ElectronAPI & {
  __handlers: Record<string, Set<Handler>>
  __emit: (event: string, payload: unknown) => void
} {
  const handlers: Record<string, Set<Handler>> = {}

  const subscribe = (event: string) => (handler: Handler) => {
    if (!handlers[event]) handlers[event] = new Set()
    handlers[event].add(handler)
    return () => {
      handlers[event]?.delete(handler)
    }
  }

  const base = {
    platform: 'test',
    onRunStarted: subscribe('runs:started'),
    onRunOutput: subscribe('runs:output'),
    onRunStatus: subscribe('runs:status'),
    onChainProgress: subscribe('chains:progress'),
    onTriggerConfirmationRequested: subscribe('triggers:confirmation-requested'),
    onContainerLogsData: subscribe('docker:logs:data'),
    onContainerLogsEnd: subscribe('docker:logs:end'),
    onContainerLogsError: subscribe('docker:logs:error'),
    onEngineIndexingStarted: subscribe('engine:indexing-started'),
    onEngineIndexingCompleted: subscribe('engine:indexing-completed'),
    onTerminalData: subscribe('terminal:data'),
    onTerminalExit: subscribe('terminal:exit'),
    onTerminalError: subscribe('terminal:error'),
    onTrayTerminalCreated: subscribe('tray:terminal-created'),
    llm: {
      bundleContext: rejected('llm.bundleContext'),
    },
  } as unknown as ElectronAPI

  const proxy = new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === '__handlers') return handlers
      if (prop === '__emit') {
        return (event: string, payload: unknown) => {
          for (const handler of handlers[event] ?? []) handler(payload)
        }
      }
      if (prop in (overrides as object)) {
        return (overrides as Record<string | symbol, unknown>)[prop]
      }
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop, receiver)
      }
      if (typeof prop === 'string') {
        return rejected(prop)
      }
      return undefined
    },
  })

  return proxy as ElectronAPI & {
    __handlers: Record<string, Set<Handler>>
    __emit: (event: string, payload: unknown) => void
  }
}

export function installElectronApiFake(
  overrides: Partial<ElectronAPI> & { llm?: Partial<ElectronAPI['llm']> } = {},
): ReturnType<typeof createElectronApiFake> {
  const api = createElectronApiFake(overrides)
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    writable: true,
    value: api,
  })
  return api
}
