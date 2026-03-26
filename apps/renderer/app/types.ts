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
