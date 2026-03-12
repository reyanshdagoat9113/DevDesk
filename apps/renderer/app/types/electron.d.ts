import type {
  AppPreferences,
  Command,
  CommandChain,
  CommandChainRunState,
  CommandTrigger,
  CommandVariable,
  Container,
  CreateCommandChainInput,
  CreateCommandTriggerInput,
  CreateCommandInput,
  Project,
  ProjectNotes,
  RunHistoryEntry,
  RunStatus,
  TriggerConfirmationRequest,
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
  openProjectFolderDialog: (startPath?: string) => Promise<{ canceled: boolean; path?: string }>
  openProjectFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInEditor: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInTerminal: (id: string) => Promise<{ success: boolean; error?: string }>
  getPreferences: () => Promise<AppPreferences>
  updatePreferences: (preferences: Partial<AppPreferences>) => Promise<{ success: boolean }>

  getCommands: () => Promise<Command[]>
  addCommand: (command: CreateCommandInput) => Promise<Command>
  updateCommand: (id: string, updates: { name?: string; command?: string; description?: string; tags?: string[] }) => Promise<Command>
  toggleCommandPin: (id: string) => Promise<Command>
  removeCommand: (id: string) => Promise<{ success: boolean }>
  getProjectDirectories: (projectId: string, relativePath?: string) => Promise<string[]>
  runCommand: (id: string, projectId?: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string; startTime: string } | { status: 'needs-input'; inputs: CommandVariable[]; preview: string }>
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

  getNotes: (projectId: string) => Promise<ProjectNotes>
  updateNotes: (projectId: string, notes: Partial<ProjectNotes>) => Promise<{ success: boolean }>

  // File Navigation
  listProjectFiles: (projectId: string, dir?: string) => Promise<{ entries: Array<{ name: string; relativePath: string; kind: 'file' | 'dir' }>; truncated: boolean }>
  searchProjectFiles: (projectId: string, query: string, limit?: number) => Promise<Array<{ relativePath: string; kind: 'file' | 'dir' }>>
  openFileInEditor: (projectId: string, relativePath: string, line?: number, column?: number) => Promise<{ success: boolean; error?: string }>
  clearFileIndex: (projectId: string) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
