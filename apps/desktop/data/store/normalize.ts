import type {
  AppPreferences,
  BugReport,
  BugSeverity,
  BugStatus,
  ChainStep,
  CommandChain,
  CommandTrigger,
  CommandTriggerEvent,
  CommandVariable,
  DataStore,
  Project,
  ProjectNotes,
} from '../model'
import {
  createDefaultPreferences,
  createDefaultStore,
  VALID_PROJECT_TYPES,
  VALID_TRIGGER_EVENTS,
} from './shared'
import { DATA_VERSION } from '../model'

const VALID_BUG_SEVERITIES = new Set<BugSeverity>(['low', 'medium', 'high', 'critical'])
const VALID_BUG_STATUSES = new Set<BugStatus>(['open', 'in_progress', 'resolved', 'closed'])

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  } catch {
    return []
  }
}

export function parseVariables(value: string | null | undefined): CommandVariable[] | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return undefined
    }
    return parsed.filter(
      (item): item is CommandVariable =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.name === 'string' &&
        typeof item.required === 'boolean'
    )
  } catch {
    return undefined
  }
}

export function parseChainStepVariables(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'
  )

  if (!entries.length) {
    return undefined
  }

  return Object.fromEntries(entries)
}

export function parseChainSteps(value: string | null | undefined): ChainStep[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.reduce<ChainStep[]>((acc, item) => {
      if (!item || typeof item !== 'object') {
        return acc
      }

      const raw = item as Partial<ChainStep>
      if (typeof raw.id !== 'string' || typeof raw.commandId !== 'string') {
        return acc
      }

      acc.push({
        id: raw.id,
        commandId: raw.commandId,
        variables: parseChainStepVariables(raw.variables),
        delayMs:
          typeof raw.delayMs === 'number' && Number.isFinite(raw.delayMs) && raw.delayMs > 0
            ? Math.max(0, Math.floor(raw.delayMs))
            : undefined,
      })
      return acc
    }, [])
  } catch {
    return []
  }
}

export function normalizeChains(value: unknown): CommandChain[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<CommandChain[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc
    }

    const raw = entry as Partial<CommandChain>
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
      return acc
    }

    acc.push({
      id: raw.id,
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
      steps: Array.isArray(raw.steps) ? parseChainSteps(JSON.stringify(raw.steps)) : [],
      stopOnFailure: raw.stopOnFailure !== false,
      parallel: raw.parallel === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    })

    return acc
  }, [])
}

export function normalizeTriggers(value: unknown): CommandTrigger[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<CommandTrigger[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc
    }

    const raw = entry as Partial<CommandTrigger>
    if (
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      typeof raw.chainId !== 'string' ||
      typeof raw.event !== 'string' ||
      !VALID_TRIGGER_EVENTS.has(raw.event as CommandTriggerEvent)
    ) {
      return acc
    }

    acc.push({
      id: raw.id,
      name: raw.name,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
      chainId: raw.chainId,
      event: raw.event as CommandTriggerEvent,
      enabled: raw.enabled !== false,
      requireConfirmation: raw.requireConfirmation === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    })

    return acc
  }, [])
}

export function normalizeNotes(value: unknown): Record<string, ProjectNotes> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>)
  return entries.reduce<Record<string, ProjectNotes>>((acc, [projectId, note]) => {
    if (!note || typeof note !== 'object') {
      acc[projectId] = { projectId, setupSteps: '', todos: '', reminders: '' }
      return acc
    }

    const raw = note as Record<string, unknown>
    const setupSteps = typeof raw.setupSteps === 'string' ? raw.setupSteps : ''
    const todos = typeof raw.todos === 'string' ? raw.todos : ''
    const reminders = typeof raw.reminders === 'string' ? raw.reminders : ''
    const ports = typeof raw.ports === 'string' ? raw.ports : ''
    const urls = typeof raw.urls === 'string' ? raw.urls : ''

    let mergedSetupSteps = setupSteps
    if (!mergedSetupSteps && (ports || urls)) {
      const sections: string[] = []
      if (ports) {
        sections.push(`Ports:\n${ports}`)
      }
      if (urls) {
        sections.push(`URLs:\n${urls}`)
      }
      mergedSetupSteps = sections.join('\n\n')
    }

    acc[projectId] = {
      projectId,
      setupSteps: mergedSetupSteps,
      todos,
      reminders,
    }
    return acc
  }, {})
}

export function normalizeProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const raw = entry as Partial<Project> & { linkedContainerNames?: unknown }
      if (
        typeof raw.id !== 'string' ||
        typeof raw.path !== 'string' ||
        typeof raw.name !== 'string' ||
        typeof raw.type !== 'string' ||
        typeof raw.icon !== 'string'
      ) {
        return null
      }

      if (!VALID_PROJECT_TYPES.has(raw.type)) {
        return null
      }

      return {
        id: raw.id,
        path: raw.path,
        name: raw.name,
        type: raw.type,
        icon: raw.icon,
        linkedContainerNames: Array.isArray(raw.linkedContainerNames)
          ? raw.linkedContainerNames.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
          : [],
      } satisfies Project
    })
    .filter((project): project is Project => Boolean(project))
}

export function normalizeBugReports(value: unknown): BugReport[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<BugReport[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc
    }

    const raw = entry as Partial<BugReport>
    if (
      typeof raw.id !== 'string' ||
      typeof raw.projectId !== 'string' ||
      typeof raw.title !== 'string' ||
      typeof raw.createdAt !== 'string' ||
      typeof raw.updatedAt !== 'string'
    ) {
      return acc
    }

    acc.push({
      id: raw.id,
      projectId: raw.projectId,
      title: raw.title,
      severity: raw.severity && VALID_BUG_SEVERITIES.has(raw.severity) ? raw.severity : 'medium',
      status: raw.status && VALID_BUG_STATUSES.has(raw.status) ? raw.status : 'open',
      expectedResult: typeof raw.expectedResult === 'string' ? raw.expectedResult : undefined,
      actualResult: typeof raw.actualResult === 'string' ? raw.actualResult : undefined,
      reproductionSteps: typeof raw.reproductionSteps === 'string' ? raw.reproductionSteps : undefined,
      notes: typeof raw.notes === 'string' ? raw.notes : undefined,
      resolutionNotes: typeof raw.resolutionNotes === 'string' ? raw.resolutionNotes : undefined,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      resolvedAt: typeof raw.resolvedAt === 'string' ? raw.resolvedAt : undefined,
    })

    return acc
  }, [])
}

export function normalizeStore(value: unknown): DataStore {
  if (!value || typeof value !== 'object') {
    return createDefaultStore()
  }

  const store = value as Partial<DataStore>
  const notes = normalizeNotes(store.notes)
  const preferences = store.preferences && typeof store.preferences === 'object'
    ? (store.preferences as Partial<AppPreferences>)
    : undefined
  const rawEngineIndexes =
    store.engineIndexes && typeof store.engineIndexes === 'object' && !Array.isArray(store.engineIndexes)
      ? store.engineIndexes
      : undefined
  const rawEngineSearchSessions =
    store.engineSearchSessions && typeof store.engineSearchSessions === 'object' && !Array.isArray(store.engineSearchSessions)
      ? store.engineSearchSessions
      : undefined
  const engineIndexes = rawEngineIndexes
    ? Object.entries(rawEngineIndexes).reduce<NonNullable<DataStore['engineIndexes']>>((acc, [projectId, entry]) => {
        if (!entry || typeof entry !== 'object') {
          return acc
        }

        const rawEntry = entry as unknown as Record<string, unknown>
        const dbPath = typeof rawEntry.dbPath === 'string' ? rawEntry.dbPath : ''
        const lastIndexed = typeof rawEntry.lastIndexed === 'string' ? rawEntry.lastIndexed : ''
        const fileCount = typeof rawEntry.fileCount === 'number' ? rawEntry.fileCount : 0

        if (!dbPath || !lastIndexed) {
          return acc
        }

        acc[projectId] = {
          projectId,
          dbPath,
          lastIndexed,
          fileCount,
        }

        return acc
      }, {})
    : undefined
  const engineSearchSessions = rawEngineSearchSessions
    ? Object.entries(rawEngineSearchSessions).reduce<NonNullable<DataStore['engineSearchSessions']>>((acc, [projectId, entry]) => {
        if (!entry || typeof entry !== 'object') {
          return acc
        }

        const rawEntry = entry as unknown as Record<string, unknown>
        const query = typeof rawEntry.query === 'string' ? rawEntry.query : ''
        const regex = typeof rawEntry.regex === 'boolean' ? rawEntry.regex : false
        const updatedAt = typeof rawEntry.updatedAt === 'string' ? rawEntry.updatedAt : ''
        const rawResult = rawEntry.result

        if (!query || !updatedAt || !rawResult || typeof rawResult !== 'object') {
          return acc
        }

        const result = rawResult as Record<string, unknown>
        const resultQuery = typeof result.query === 'string' ? result.query : query
        const totalMatches = typeof result.totalMatches === 'number' ? result.totalMatches : 0
        const durationMs = typeof result.durationMs === 'number' ? result.durationMs : 0
        const rawResults = Array.isArray(result.results) ? result.results : []

        acc[projectId] = {
          projectId,
          query,
          regex,
          updatedAt,
          result: {
            ok: result.ok !== false,
            query: resultQuery,
            totalMatches,
            durationMs,
            results: rawResults.map((item) => {
              const rawItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
              const rawMatches = Array.isArray(rawItem.matches) ? rawItem.matches : []
              return {
                path: typeof rawItem.path === 'string' ? rawItem.path : '',
                language: typeof rawItem.language === 'string' ? rawItem.language : null,
                score: typeof rawItem.score === 'number' ? rawItem.score : 0,
                matches: rawMatches.map((match) => {
                  const rawMatch = match && typeof match === 'object' ? (match as Record<string, unknown>) : {}
                  return {
                    line: typeof rawMatch.line === 'number' ? rawMatch.line : 1,
                    column: typeof rawMatch.column === 'number' ? rawMatch.column : 1,
                    snippet: typeof rawMatch.snippet === 'string' ? rawMatch.snippet : '',
                    contextBefore: Array.isArray(rawMatch.contextBefore)
                      ? rawMatch.contextBefore.filter((value): value is string => typeof value === 'string')
                      : [],
                    contextAfter: Array.isArray(rawMatch.contextAfter)
                      ? rawMatch.contextAfter.filter((value): value is string => typeof value === 'string')
                      : [],
                  }
                }),
              }
            }).filter((item) => item.path),
          },
        }

        return acc
      }, {})
    : undefined

  const defaults = createDefaultPreferences()

  return {
    version: DATA_VERSION,
    projects: normalizeProjects(store.projects),
    commands: Array.isArray(store.commands) ? store.commands : [],
    chains: normalizeChains(store.chains),
    triggers: normalizeTriggers(store.triggers),
    runHistory: Array.isArray(store.runHistory) ? store.runHistory : [],
    notes,
    preferences: {
      editor: {
        id: preferences?.editor?.id ?? defaults.editor.id,
        command: preferences?.editor?.command,
      },
      terminal: {
        id: preferences?.terminal?.id ?? defaults.terminal.id,
        command: preferences?.terminal?.command,
      },
      trayEnabled: typeof preferences?.trayEnabled === 'boolean' ? preferences.trayEnabled : defaults.trayEnabled,
    },
    engineIndexes,
    engineSearchSessions,
    bugReports: normalizeBugReports(store.bugReports),
  }
}
