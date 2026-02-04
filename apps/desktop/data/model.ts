export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown'

export interface Project {
  id: string
  path: string
  name: string
  type: ProjectType
  icon: string
}

export interface Command {
  id: string
  name: string
  command: string
  description?: string
  tags?: string[]
  projectId?: string
  workingDirectory?: string
}

export interface Container {
  id: string
  name: string
  image: string
  state: 'running' | 'stopped' | 'paused'
  ports: string[]
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

export const DATA_VERSION = 2 as const

export interface DataStore {
  version: typeof DATA_VERSION
  projects: Project[]
  commands: Command[]
  runHistory: RunHistoryEntry[]
  notes: Record<string, ProjectNotes>
  preferences: AppPreferences
}
