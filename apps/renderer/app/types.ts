export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown'

export type CommandPresetIcon = 'package' | 'play' | 'hammer' | 'check-circle' | 'alert-circle' | 'wrench'

export interface Project {
  id: string
  path: string
  name: string
  type: ProjectType
  icon: string
  linkedContainerNames: string[]
  isPinned?: boolean
  pinnedAt?: string
}

export interface CommandVariable {
  name: string
  default?: string
  required: boolean
  description?: string
}

export interface Command {
  id: string
  name: string
  command: string
  description?: string
  tags?: string[]
  projectId?: string
  workingDirectory?: string
  variables?: CommandVariable[]
  isPinned?: boolean
  pinnedAt?: string
}

export interface CreateCommandInput {
  name: string
  command: string
  description?: string
  tags?: string[]
  projectId?: string
  workingDirectory?: string
}

export interface CommandPreset {
  id: string
  name: string
  command: string
  description?: string
  icon: CommandPresetIcon
  tags?: string[]
}

export interface ChainStep {
  id: string
  commandId: string
  variables?: Record<string, string>
  delayMs?: number
}

export interface CommandChain {
  id: string
  name: string
  description?: string
  projectId?: string
  steps: ChainStep[]
  stopOnFailure: boolean
  parallel: boolean
  createdAt: string
  updatedAt: string
}

export type CommandTriggerEvent = 'onProjectOpen' | 'afterContainerStart' | 'onStartup'

export interface CommandTrigger {
  id: string
  name: string
  description?: string
  projectId?: string
  chainId: string
  event: CommandTriggerEvent
  enabled: boolean
  requireConfirmation: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCommandTriggerInput {
  name: string
  description?: string
  projectId?: string
  chainId: string
  event: CommandTriggerEvent
  enabled?: boolean
  requireConfirmation?: boolean
}

export interface TriggerConfirmationRequest {
  id: string
  triggerId: string
  triggerName: string
  chainId: string
  chainName: string
  event: CommandTriggerEvent
  projectId?: string
  projectName?: string
  containerNames?: string[]
  createdAt: string
}

export interface CreateCommandChainInput {
  name: string
  description?: string
  projectId?: string
  steps: ChainStep[]
  stopOnFailure: boolean
  parallel?: boolean
}

export type ChainStepRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'stopped' | 'skipped'

export interface ChainStepRunState {
  stepId: string
  commandId: string
  status: ChainStepRunStatus
  runId?: string
  startedAt?: string
  endedAt?: string
  error?: string
}

export interface CommandChainRunState {
  runId: string
  chainId: string
  projectId?: string
  status: 'running' | 'success' | 'failed' | 'stopped'
  startedAt: string
  endedAt?: string
  activeStepId?: string
  error?: string
  steps: ChainStepRunState[]
}

export interface Container {
  id: string
  name: string
  image: string
  state: 'running' | 'stopped' | 'paused'
  ports: string[]
  status?: string
  createdAt?: string
  labels?: string[]
  command?: string
}

export type RunStatus = 'running' | 'success' | 'failed' | 'stopped'

export interface RunHistoryEntry {
  id: string
  commandId: string
  projectId?: string
  status: RunStatus
  startTime: string
  endTime?: string
  output?: string
  resolvedCommand?: string
}

export interface ProjectNotes {
  projectId: string
  setupSteps: string
  todos: string
  reminders: string
}

export interface AppPreference {
  id: string
  command?: string
}

export interface AppPreferences {
  editor: AppPreference
  terminal: AppPreference
}

export interface EngineIndexMeta {
  projectId: string
  dbPath: string
  lastIndexed: string
  fileCount: number
}

export interface EngineStatus {
  available: boolean
  version?: string
  error?: string
}

export interface EngineSearchMatch {
  line: number
  column: number
  snippet: string
  contextBefore: string[]
  contextAfter: string[]
}

export interface EngineSearchFileResult {
  path: string
  language: string | null
  score: number
  matches: EngineSearchMatch[]
}

export interface EngineSearchResult {
  ok: boolean
  query: string
  results: EngineSearchFileResult[]
  totalMatches: number
  durationMs: number
}

export interface EngineSearchSession {
  projectId: string
  query: string
  regex: boolean
  updatedAt: string
  result: EngineSearchResult
}

export interface EngineStats {
  ok: boolean
  db: string
  stats: {
    totalFiles: number
    totalSizeBytes: number
    byLanguage: Record<string, number>
    indexedAt: string
  }
}
