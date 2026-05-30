import type {
  AddBugAttachmentInput,
  AppPreferences,
  BugApiResult,
  BugAttachment,
  BugContextSnapshot,
  BugContextSnapshotData,
  BugReport,
  BugReportFilters,
  Command,
  CommandChain,
  CommandChainRunState,
  CommandTrigger,
  CommandVariable,
  CreateBugReportInput,
  Container,
  CreateCommandChainInput,
  CreateCommandTriggerInput,
  CreateCommandInput,
  ExportResult,
  ImportMode,
  ImportResult,
  Project,
  ProjectNotes,
  EngineGitInsights,
  GitCommitResult,
  GitCreatePullRequestResult,
  GitPushResult,
  GitWorkflowState,
  HealthCheckRun,
  HealthCheckRunSummary,
  EngineIndexCompletedPayload,
  EngineIndexLifecyclePayload,
  EngineIndexResult,
  EngineIndexMeta,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  ProjectHealthReport,
  RunHistoryEntry,
  RunStatus,
  TriggerConfirmationRequest,
  UpdateBugReportInput,
} from '../types'

export interface ElectronAPI {
  platform: string
  getProjects: () => Promise<Project[]>
  listWslDistros: () => Promise<string[]>
  addProject: (path: string) => Promise<Project>
  removeProject: (id: string) => Promise<{ success: boolean }>
  updateProject: (id: string, updates: { name: string }) => Promise<Project>
  toggleProjectPin: (id: string) => Promise<Project>
  setProjectLinkedContainers: (id: string, linkedContainerNames: string[]) => Promise<Project>
  startProjectDevStack: (id: string) => Promise<{ success: boolean; started: string[]; resumed: string[]; alreadyRunning: string[]; missing: string[] }>
  stopProjectDevStack: (id: string) => Promise<{ success: boolean; stopped: string[]; alreadyStopped: string[]; missing: string[] }>
  restartProjectDevStack: (id: string) => Promise<{ success: boolean; stopped: string[]; started: string[]; missing: string[] }>
  openProjectFolderDialog: (startPath?: string) => Promise<{ canceled: boolean; path?: string }>
  openProjectFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInEditor: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInTerminal: (id: string) => Promise<{ success: boolean; error?: string }>
  inspectProject: (id: string) => Promise<ProjectHealthReport>
  getPreferences: () => Promise<AppPreferences>
  updatePreferences: (preferences: Partial<AppPreferences>) => Promise<{ success: boolean }>

  getProjectNotes: (projectId: string) => Promise<ProjectNotes>
  updateProjectNotes: (projectId: string, updates: Partial<ProjectNotes>) => Promise<void>

  createBug: (input: CreateBugReportInput) => Promise<BugApiResult<BugReport>>
  updateBug: (id: string, updates: UpdateBugReportInput) => Promise<BugApiResult<BugReport>>
  deleteBug: (id: string) => Promise<BugApiResult<{ success: boolean }>>
  getBug: (id: string) => Promise<BugApiResult<BugReport | null>>
  listBugs: (filters?: BugReportFilters) => Promise<BugApiResult<BugReport[]>>
  captureContext: (projectId: string) => Promise<BugApiResult<BugContextSnapshotData>>
  getBugContextSnapshot: (bugReportId: string) => Promise<BugApiResult<BugContextSnapshot | null>>
  listBugAttachments: (bugReportId: string) => Promise<BugApiResult<BugAttachment[]>>
  addBugAttachment: (input: AddBugAttachmentInput) => Promise<BugApiResult<BugAttachment>>
  removeBugAttachment: (attachmentId: string) => Promise<BugApiResult<{ success: boolean }>>
  pickAttachmentFile: (options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<BugApiResult<{ canceled: boolean; filePaths: string[] }>>

  getCommands: () => Promise<Command[]>
  addCommand: (command: CreateCommandInput) => Promise<Command>
  updateCommand: (id: string, updates: { name?: string; command?: string; description?: string; tags?: string[] }) => Promise<Command>
  toggleCommandPin: (id: string) => Promise<Command>
  removeCommand: (id: string) => Promise<{ success: boolean }>
  getProjectDirectories: (projectId: string, relativePath?: string) => Promise<string[]>
  runCommand: (id: string, projectId?: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string; startTime: string } | { status: 'needs-input'; inputs: CommandVariable[]; preview: string }>
  runAdhocCommand: (projectId: string, command: string, options?: { workingDirectory?: string }) => Promise<{ runId: string; status: string; startTime: string } | { status: 'needs-input'; inputs: CommandVariable[]; preview: string }>
  detectCommandVariables: (command: string) => Promise<CommandVariable[]>
  stopCommand: (runId: string) => Promise<{ success: boolean }>
  onRunStarted: (handler: (payload: { id: string; commandId: string; projectId?: string; status: string; startTime: string; output?: string; resolvedCommand?: string }) => void) => () => void
  onRunOutput: (handler: (payload: { runId: string; chunk: string }) => void) => () => void
  onRunStatus: (handler: (payload: { runId: string; status: string }) => void) => () => void

  getChains: () => Promise<CommandChain[]>
  addChain: (chain: CreateCommandChainInput) => Promise<CommandChain>
  updateChain: (id: string, updates: CreateCommandChainInput) => Promise<CommandChain>
  removeChain: (id: string) => Promise<{ success: boolean }>
  runChain: (id: string, projectId?: string) => Promise<{ runId: string; status: string }>
  onChainProgress: (handler: (payload: CommandChainRunState) => void) => () => void

  getTriggers: () => Promise<CommandTrigger[]>
  addTrigger: (trigger: CreateCommandTriggerInput) => Promise<CommandTrigger>
  updateTrigger: (id: string, updates: CreateCommandTriggerInput) => Promise<CommandTrigger>
  removeTrigger: (id: string) => Promise<{ success: boolean }>
  notifyTriggerEvent: (event: 'onProjectOpen', payload: { projectId: string }) => Promise<{ success: boolean }>
  getPendingTriggerConfirmations: () => Promise<TriggerConfirmationRequest[]>
  respondToTriggerConfirmation: (requestId: string, approved: boolean) => Promise<{ success: boolean }>
  onTriggerConfirmationRequested: (handler: (payload: TriggerConfirmationRequest) => void) => () => void

  getContainers: () => Promise<Container[]>
  startContainer: (id: string) => Promise<{ success: boolean }>
  stopContainer: (id: string) => Promise<{ success: boolean }>
  restartContainer: (id: string) => Promise<{ success: boolean }>
  pauseContainer: (id: string) => Promise<{ success: boolean }>
  unpauseContainer: (id: string) => Promise<{ success: boolean }>
  removeContainer: (id: string, force?: boolean) => Promise<{ success: boolean }>
  getContainerLogs: (id: string) => Promise<string>
  subscribeContainerLogs: (id: string, tail?: number) => Promise<{ subscriptionId: string }>
  unsubscribeContainerLogs: (subscriptionId: string) => Promise<{ success: boolean }>
  onContainerLogsData: (handler: (payload: { subscriptionId: string; containerId: string; chunk: string }) => void) => () => void
  onContainerLogsEnd: (handler: (payload: { subscriptionId: string; containerId: string; code: number | null }) => void) => () => void
  onContainerLogsError: (handler: (payload: { subscriptionId: string; containerId: string; error: string }) => void) => () => void

  getRunHistory: () => Promise<RunHistoryEntry[]>
  listRecentHistory: (limit?: number) => Promise<{ id: string; commandId: string; projectId?: string; status: RunStatus; startTime: string; endTime?: string }[]>
  getRunOutput: (runId: string) => Promise<string>
  clearRunHistory: () => Promise<{ success: boolean }>
  removeRunHistory: (runId: string) => Promise<{ success: boolean }>

  // File Navigation
  listProjectFiles: (projectId: string, dir?: string) => Promise<{ entries: Array<{ name: string; relativePath: string; kind: 'file' | 'dir' }>; truncated: boolean }>
  searchProjectFiles: (projectId: string, query: string, limit?: number) => Promise<Array<{ relativePath: string; kind: 'file' | 'dir' }>>
  openFileInEditor: (projectId: string, relativePath: string, line?: number, column?: number) => Promise<{ success: boolean; error?: string }>
  revealFileInFolder: (projectId: string, relativePath: string) => Promise<{ success: boolean; error?: string }>
  clearFileIndex: (projectId: string) => Promise<{ success: boolean }>
  openExternalUrl: (url: string) => Promise<{ success: boolean }>

  getEngineState: () => Promise<{
    status: EngineStatus
    indexes: Record<string, EngineIndexMeta>
    searchSessions: Record<string, EngineSearchSession>
  }>
  indexProject: (projectId: string) => Promise<EngineIndexResult>
  searchProjectContent: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<{ ok: boolean; query: string; results: Array<{ path: string; language: string | null; score: number; matches: Array<{ line: number; column: number; snippet: string; contextBefore: string[]; contextAfter: string[] }> }>; totalMatches: number; durationMs: number }>
  getProjectStats: (projectId: string) => Promise<EngineStats | null>
  getProjectGitInsights: (projectId: string) => Promise<EngineGitInsights | null>
  getProjectGitState: (projectId: string) => Promise<GitWorkflowState>
  commitProjectChanges: (projectId: string, message: string) => Promise<GitCommitResult>
  pushProjectBranch: (projectId: string) => Promise<GitPushResult>
  createProjectPullRequest: (
    projectId: string,
    input: { title: string; body: string; isDraft: boolean; baseBranch?: string }
  ) => Promise<GitCreatePullRequestResult>
  clearProjectIndex: (projectId: string) => Promise<{ success: boolean }>
  clearProjectSearchSession: (projectId: string) => Promise<{ success: boolean }>
  isEngineAvailable: () => Promise<boolean>
  onEngineIndexingStarted: (handler: (payload: EngineIndexLifecyclePayload) => void) => () => void
  onEngineIndexingCompleted: (handler: (payload: EngineIndexCompletedPayload) => void) => () => void

  // Terminal
  createTerminal: (options: { projectId?: string; cwd?: string; shell?: string; cols?: number; rows?: number }) => Promise<{ terminalId: string }>
  writeTerminal: (terminalId: string, data: string) => Promise<void>
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<void>
  closeTerminal: (terminalId: string) => Promise<void>
  onTerminalData: (handler: (payload: { terminalId: string; data: string }) => void) => () => void
  onTerminalExit: (handler: (payload: { terminalId: string; code?: number }) => void) => () => void
  onTerminalError: (handler: (payload: { terminalId: string; error: string }) => void) => () => void

  // Health Check
  runHealthCheck: (projectId: string) => Promise<HealthCheckRun>
  getLatestHealthCheck: (projectId: string) => Promise<HealthCheckRun | null>
  listHealthCheckRuns: (projectId: string, limit?: number) => Promise<HealthCheckRunSummary[]>
  getHealthCheckRun: (runId: string) => Promise<HealthCheckRun | null>

  exportData: () => Promise<ExportResult>
  importData: (data: unknown, mode: ImportMode) => Promise<ImportResult>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
