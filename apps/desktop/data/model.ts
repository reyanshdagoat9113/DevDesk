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

export type ProjectPackageManager = 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'cargo' | 'go'

export type ProjectHealthStatus = 'healthy' | 'warning' | 'critical'

export interface HealthSuggestion {
  id: string
  type: 'warning' | 'info' | 'success'
  message: string
  action?: {
    label: string
    command?: string
    chainId?: string
  }
}

export interface ProjectHealthReport {
  projectId: string
  analyzedAt: string
  packageManager?: ProjectPackageManager
  hasNodeModules?: boolean
  hasLockfile?: boolean
  hasDockerCompose?: boolean
  hasGit?: boolean
  nodeVersion?: string
  availableScripts?: string[]
  missingDeps?: boolean
  status: ProjectHealthStatus
  suggestions: HealthSuggestion[]
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
  trayEnabled: boolean
}

export interface TerminalSession {
  id: string
  projectId?: string
  cwd: string
  shell: string
  createdAt: string
  cols: number
  rows: number
}

export interface TerminalCreateOptions {
  projectId?: string
  cwd?: string
  shell?: string
  cols?: number
  rows?: number
}

export interface EngineIndexMeta {
  projectId: string
  /** Absolute SQLite path in engine canonical form (forward slashes) */
  dbPath: string
  lastIndexed: string
  fileCount: number
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

export interface EngineSearchSession {
  projectId: string
  query: string
  regex: boolean
  updatedAt: string
  result: {
    ok: boolean
    query: string
    results: EngineSearchFileResult[]
    totalMatches: number
    durationMs: number
  }
}

export type HealthCheckItemStatus = 'pass' | 'warning' | 'fail' | 'skipped'
export type HealthCheckRunStatus = 'pass' | 'warning' | 'fail'
export type HealthCheckCategory = 'system' | 'project' | 'runtime'

export interface HealthCheckItem {
  id: string
  runId: string
  category: HealthCheckCategory
  key: string
  label: string
  status: HealthCheckItemStatus
  message: string
  detailsJson: string
  suggestedFix: string
}

export interface HealthCheckRun {
  id: string
  projectId: string
  startedAt: string
  finishedAt?: string
  overallStatus: HealthCheckRunStatus
  summaryJson: string
  items: HealthCheckItem[]
}

export type BugSeverity = 'low' | 'medium' | 'high' | 'critical'
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface BugReport {
  id: string
  projectId: string
  title: string
  severity: BugSeverity
  status: BugStatus
  expectedResult?: string
  actualResult?: string
  reproductionSteps?: string
  notes?: string
  resolutionNotes?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

export interface CreateBugReportInput {
  projectId: string
  title: string
  severity?: BugSeverity
  status?: BugStatus
  expectedResult?: string
  actualResult?: string
  reproductionSteps?: string
  notes?: string
  resolutionNotes?: string
}

export type UpdateBugReportInput = Partial<
  Pick<
    BugReport,
    'title' | 'severity' | 'status' | 'expectedResult' | 'actualResult' | 'reproductionSteps' | 'notes' | 'resolutionNotes'
  >
>

export interface BugReportFilters {
  projectId?: string
  status?: BugStatus
  severity?: BugSeverity
}

export interface BugContextSnapshot {
  id: string
  bugReportId: string
  commandHistoryJson: string
  runHistoryJson: string
  logsJson: string
  environmentSnapshotJson: string
  activeContainerStateJson: string
  healthSnapshotJson: string
  notesSnippetJson: string
}

export interface BugContextSnapshotData {
  commandHistoryJson: string
  runHistoryJson: string
  logsJson: string
  environmentSnapshotJson: string
  activeContainerStateJson: string
  healthSnapshotJson: string
  notesSnippetJson: string
}

export type BugAttachmentKind = 'screenshot' | 'log' | 'file' | 'env_snapshot'

export interface BugAttachment {
  id: string
  bugReportId: string
  kind: BugAttachmentKind
  fileName: string
  filePath: string
  fileSize: number
  mimeType?: string
  createdAt: string
}

export interface AddBugAttachmentInput {
  bugReportId: string
  kind?: BugAttachmentKind
  sourceFilePath: string
  mimeType?: string
}

export const DATA_VERSION = 5 as const

export interface DataStore {
  version: typeof DATA_VERSION
  projects: Project[]
  commands: Command[]
  chains: CommandChain[]
  triggers: CommandTrigger[]
  runHistory: RunHistoryEntry[]
  notes: Record<string, ProjectNotes>
  preferences: AppPreferences
  engineIndexes?: Record<string, EngineIndexMeta>
  engineSearchSessions?: Record<string, EngineSearchSession>
  bugReports: BugReport[]
}
