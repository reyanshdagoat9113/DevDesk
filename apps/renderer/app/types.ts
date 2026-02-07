export interface Project {
  id: string
  path: string
  name: string
  type: 'node' | 'python' | 'rust' | 'go' | 'unknown'
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
  status?: string
  createdAt?: string
  labels?: string[]
  command?: string
}

export interface RunHistoryEntry {
  id: string
  commandId: string
  projectId?: string
  status: 'running' | 'success' | 'failed' | 'stopped'
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
