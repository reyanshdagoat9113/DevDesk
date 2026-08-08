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

export interface ProjectNotes {
  projectId: string
  setupSteps: string
  todos: string
  reminders: string
}

export type BugSeverity = 'low' | 'medium' | 'high' | 'critical'
export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type BugApiErrorCode = 'validation' | 'not_found' | 'internal'

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
  contextSnapshot?: BugContextSnapshotData
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

export interface BugApiError {
  code: BugApiErrorCode
  message: string
}

export type BugApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BugApiError }

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

export interface AppPreference {
  id: string
  command?: string
}

export interface AppPreferences {
  editor: AppPreference
  terminal: AppPreference
  trayEnabled: boolean
}

export interface EngineIndexMeta {
  projectId: string
  dbPath: string
  lastIndexed: string
  fileCount: number
  /** Profile used on the last successful index. */
  indexProfile?: EngineIndexProfile
}

export type EngineIndexProfile = 'source-first' | 'source-docs' | 'full-text'

export interface EngineIndexResult {
  ok: boolean
  repo: string
  db: string
  filesIndexed: number
  filesSkipped: number
  durationMs: number
  warnings: string[]
  profile?: EngineIndexProfile
  skipReasons?: {
    binary: number
    language: number
    profile: number
    devdeskignore: number
    unchanged: number
  }
  metrics?: {
    logicalIndexedBytes: number
    searchableContentBytes: number
    physicalDbBytes: number
  }
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
    /** Logical indexed bytes: SUM(size_bytes) */
    totalSizeBytes: number
    searchableContentBytes?: number
    physicalDbBytes?: number
    byLanguage: Record<string, number>
    indexedAt: string
    largestFiles?: Array<{ path: string; sizeBytes: number; language: string | null }>
  }
}

export type LlmBundleSection = 'files' | 'runHistory' | 'health' | 'bugs' | 'notes' | 'engineStats'

export interface LlmBundleOptions {
  sections?: LlmBundleSection[]
  maxTokens?: number
  bugReportId?: string
  includePatterns?: string[]
  excludePatterns?: string[]
}

export interface LlmBundleResult {
  markdown: string
  tokenEstimate: number
  includedFiles: string[]
  excludedFiles: string[]
  warnings: string[]
}

export interface EngineGitInsights {
  branch: string
  totalCommits: number
  contributors: string[]
  hotspots: Array<{
    path: string
    score: number
    commits: number
    recency: number
    risk: 'low' | 'medium' | 'high'
  }>
  recentCommits: Array<{
    hash: string
    author: string
    date: string
    message: string
    files: string[]
  }>
  churnFiles: Array<{
    path: string
    commits: number
    authors: string[]
    lastModified: string
    linesAdded: number
    linesDeleted: number
  }>
  workingTree: {
    isClean: boolean
    hasStagedChanges: boolean
    hasUnstagedChanges: boolean
    hasUntrackedChanges: boolean
    hasConflicts: boolean
    stagedCount: number
    unstagedCount: number
    untrackedCount: number
    conflictedCount: number
    ahead: number
    behind: number
    files: Array<{
      path: string
      previousPath?: string
      indexStatus: string
      workingTreeStatus: string
      staged: boolean
      unstaged: boolean
      untracked: boolean
      conflicted: boolean
      summary: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'conflicted' | 'unknown'
      additions: number
      deletions: number
    }>
  }
}

export interface GitWorkflowState {
  ok: boolean
  available: boolean
  repoPath: string
  branch: string | null
  upstream: string | null
  remoteName: string | null
  remoteUrl: string | null
  provider: 'github' | 'unknown'
  ahead: number
  behind: number
  canPush: boolean
  canCreatePullRequest: boolean
  message?: string
  workingTree: EngineGitInsights['workingTree'] | null
}

export interface GitCommitResult {
  ok: boolean
  message: string
  branch: string | null
  commitHash?: string
}

export interface GitPushResult {
  ok: boolean
  message: string
  branch: string | null
  remoteName: string | null
  remoteUrl: string | null
}

export interface GitCreatePullRequestResult {
  ok: boolean
  message: string
  url?: string
  mode?: 'created' | 'manual'
  branch: string | null
  baseBranch: string | null
  isDraft: boolean
}

export type GitDiffScope = 'staged' | 'unstaged' | 'untracked'

export type GitDiffLineKind = 'meta' | 'hunk' | 'context' | 'add' | 'del'

export interface GitDiffLine {
  kind: GitDiffLineKind
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface GitDiffSection {
  scope: GitDiffScope
  label: string
  binary: boolean
  truncated: boolean
  additions: number
  deletions: number
  lines: GitDiffLine[]
}

export interface GitFileDiffResult {
  ok: boolean
  available: boolean
  path: string
  previousPath?: string
  message?: string
  sections: GitDiffSection[]
}

export interface EngineIndexLifecyclePayload {
  projectId: string
}

export interface EngineIndexCompletedPayload extends EngineIndexLifecyclePayload {
  result: EngineIndexResult
}

export interface TerminalSessionState {
  id: string
  label: string
  projectId?: string
}

// ── Health Check Types ──────────────────────────────────────────────

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

export type HealthCheckRunSummary = Omit<HealthCheckRun, 'items'>

export interface ExportHeader {
  version: number
  exportedAt: string
  platform: string
}

export interface ExportData {
  version: number
  exportedAt: string
  platform: string
  tables: Record<string, unknown[][]>
}

export interface ExportResult {
  success: boolean
  data: ExportData
  recordCounts: Record<string, number>
}

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  success: boolean
  recordCounts: Record<string, number>
  backupPath?: string
  warnings?: string[]
  error?: string
}

export interface ExportToFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  recordCounts?: Record<string, number>
  error?: string
}

export interface ImportPreviewResult {
  success: boolean
  canceled?: boolean
  data?: ExportData
  recordCounts?: Record<string, number>
  warnings?: string[]
  error?: string
}
