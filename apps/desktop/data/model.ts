export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown'

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
  /** Variable name (e.g., "version", "message") */
  name: string
  /** Default value if not provided */
  default?: string
  /** Whether user must provide this value */
  required: boolean
  /** Description shown in the prompt */
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
  /** Detected/defined variables for this command */
  variables?: CommandVariable[]
  isPinned?: boolean
  pinnedAt?: string
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

export const DATA_VERSION = 4 as const

export interface DataStore {
  version: typeof DATA_VERSION
  projects: Project[]
  commands: Command[]
  chains: CommandChain[]
  triggers: CommandTrigger[]
  runHistory: RunHistoryEntry[]
  notes: Record<string, ProjectNotes>
  preferences: AppPreferences
}
