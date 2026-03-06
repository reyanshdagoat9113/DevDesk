import { contextBridge, ipcRenderer } from 'electron'

// Define the API interface
interface ElectronAPI {
  platform: string
  getProjects: () => Promise<unknown[]>
  listWslDistros: () => Promise<string[]>
  addProject: (path: string) => Promise<{ id: string; path: string }>
  removeProject: (id: string) => Promise<{ success: boolean }>
  updateProject: (id: string, updates: { name: string }) => Promise<{ id: string; name: string }>
  toggleProjectPin: (id: string) => Promise<unknown>
  setProjectLinkedContainers: (id: string, linkedContainerNames: string[]) => Promise<unknown>
  startProjectDevStack: (id: string) => Promise<{ success: boolean; started: string[]; resumed: string[]; alreadyRunning: string[]; missing: string[] }>
  stopProjectDevStack: (id: string) => Promise<{ success: boolean; stopped: string[]; alreadyStopped: string[]; missing: string[] }>
  openProjectFolderDialog: (startPath?: string) => Promise<{ canceled: boolean; path?: string }>
  openProjectFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInEditor: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInTerminal: (id: string) => Promise<{ success: boolean; error?: string }>
  getPreferences: () => Promise<{ editor: { id: string; command?: string }; terminal: { id: string; command?: string } }>
  updatePreferences: (preferences: {
    editor?: { id: string; command?: string }
    terminal?: { id: string; command?: string }
  }) => Promise<{ success: boolean }>

  getCommands: () => Promise<unknown[]>
  addCommand: (command: { name: string; command: string; description?: string; tags?: string[]; projectId?: string; workingDirectory?: string }) => Promise<{ id: string }>
  updateCommand: (id: string, updates: { name?: string; command?: string; description?: string; tags?: string[] }) => Promise<{ id: string }>
  toggleCommandPin: (id: string) => Promise<unknown>
  removeCommand: (id: string) => Promise<{ success: boolean }>
  getProjectDirectories: (projectId: string, relativePath?: string) => Promise<string[]>
  runCommand: (id: string, projectId?: string, variables?: Record<string, string>) => Promise<{ runId: string; status: string } | { status: 'needs-input'; inputs: Array<{ name: string; default?: string; required: boolean; description?: string }>; preview: string }>
  detectCommandVariables: (command: string) => Promise<Array<{ name: string; default?: string; required: boolean; description?: string }>>
  stopCommand: (runId: string) => Promise<{ success: boolean }>
  onRunOutput: (handler: (payload: { runId: string; chunk: string }) => void) => () => void
  onRunStatus: (handler: (payload: { runId: string; status: string }) => void) => () => void

  getChains: () => Promise<unknown[]>
  addChain: (chain: {
    name: string
    description?: string
    projectId?: string
    steps: Array<{ id: string; commandId: string; variables?: Record<string, string>; delayMs?: number }>
    stopOnFailure: boolean
    parallel?: boolean
  }) => Promise<unknown>
  updateChain: (id: string, updates: {
    name: string
    description?: string
    projectId?: string
    steps: Array<{ id: string; commandId: string; variables?: Record<string, string>; delayMs?: number }>
    stopOnFailure: boolean
    parallel?: boolean
  }) => Promise<unknown>
  removeChain: (id: string) => Promise<{ success: boolean }>
  runChain: (id: string, projectId?: string) => Promise<{ runId: string; status: string }>
  onChainProgress: (handler: (payload: unknown) => void) => () => void

  getTriggers: () => Promise<unknown[]>
  addTrigger: (trigger: {
    name: string
    description?: string
    projectId?: string
    chainId: string
    event: 'onProjectOpen' | 'afterContainerStart' | 'onStartup'
    enabled?: boolean
    requireConfirmation?: boolean
  }) => Promise<unknown>
  updateTrigger: (id: string, updates: {
    name: string
    description?: string
    projectId?: string
    chainId: string
    event: 'onProjectOpen' | 'afterContainerStart' | 'onStartup'
    enabled?: boolean
    requireConfirmation?: boolean
  }) => Promise<unknown>
  removeTrigger: (id: string) => Promise<{ success: boolean }>
  notifyTriggerEvent: (event: 'onProjectOpen', payload: { projectId: string }) => Promise<{ success: boolean }>
  getPendingTriggerConfirmations: () => Promise<unknown[]>
  respondToTriggerConfirmation: (requestId: string, approved: boolean) => Promise<{ success: boolean }>
  onTriggerConfirmationRequested: (handler: (payload: unknown) => void) => () => void

  getContainers: () => Promise<unknown[]>
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

  getRunHistory: () => Promise<unknown[]>
  listRecentHistory: (limit?: number) => Promise<{ id: string; commandId: string; projectId?: string; status: string; startTime: string; endTime?: string }[]>
  getRunOutput: (runId: string) => Promise<string>
  clearRunHistory: () => Promise<{ success: boolean }>

  getNotes: (projectId: string) => Promise<{ setupSteps: string; todos: string; reminders: string }>
  updateNotes: (projectId: string, notes: { setupSteps?: string; todos?: string; reminders?: string }) => Promise<{ success: boolean }>

  listProjectFiles: (projectId: string, dir?: string) => Promise<{ entries: Array<{ name: string; relativePath: string; kind: 'file' | 'dir' }>; truncated: boolean }>
  searchProjectFiles: (projectId: string, query: string, limit?: number) => Promise<Array<{ relativePath: string; kind: 'file' | 'dir' }>>
  openFileInEditor: (projectId: string, relativePath: string, line?: number, column?: number) => Promise<{ success: boolean; error?: string }>
  clearFileIndex: (projectId: string) => Promise<{ success: boolean }>
}

// Expose a safe API to the renderer process
const electronAPI: ElectronAPI = {
  platform: process.platform,
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:get'),
  listWslDistros: () => ipcRenderer.invoke('wsl:list-distros'),
  addProject: (path: string) => ipcRenderer.invoke('projects:add', path),
  removeProject: (id: string) => ipcRenderer.invoke('projects:remove', id),
  updateProject: (id: string, updates: { name: string }) =>
    ipcRenderer.invoke('projects:update', id, updates),
  toggleProjectPin: (id: string) => ipcRenderer.invoke('projects:toggle-pin', id),
  setProjectLinkedContainers: (id: string, linkedContainerNames: string[]) =>
    ipcRenderer.invoke('projects:set-linked-containers', id, linkedContainerNames),
  startProjectDevStack: (id: string) => ipcRenderer.invoke('projects:start-dev-stack', id),
  stopProjectDevStack: (id: string) => ipcRenderer.invoke('projects:stop-dev-stack', id),
  openProjectFolderDialog: (startPath?: string) => ipcRenderer.invoke('dialog:open-folder', startPath),
  openProjectFolder: (id: string) => ipcRenderer.invoke('projects:open-folder', id),
  openProjectInEditor: (id: string) => ipcRenderer.invoke('projects:open-editor', id),
  openProjectInTerminal: (id: string) => ipcRenderer.invoke('projects:open-terminal', id),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  updatePreferences: (preferences: { editor?: { id: string; command?: string }; terminal?: { id: string; command?: string } }) =>
    ipcRenderer.invoke('preferences:update', preferences),

  // Commands
  getCommands: () => ipcRenderer.invoke('commands:get'),
  addCommand: (command: { name: string; command: string; description?: string; tags?: string[]; projectId?: string; workingDirectory?: string }) =>
    ipcRenderer.invoke('commands:add', command),
  updateCommand: (id: string, updates: { name?: string; command?: string; description?: string; tags?: string[] }) =>
    ipcRenderer.invoke('commands:update', id, updates),
  toggleCommandPin: (id: string) => ipcRenderer.invoke('commands:toggle-pin', id),
  removeCommand: (id: string) => ipcRenderer.invoke('commands:remove', id),
  getProjectDirectories: (projectId: string, relativePath?: string) =>
    ipcRenderer.invoke('commands:get-directories', projectId, relativePath),
  runCommand: (id: string, projectId?: string, variables?: Record<string, string>) =>
    ipcRenderer.invoke('commands:run', id, projectId, variables),
  detectCommandVariables: (command: string) => ipcRenderer.invoke('commands:detect-variables', command),
  stopCommand: (runId: string) => ipcRenderer.invoke('commands:stop', runId),
  onRunOutput: (handler: (payload: { runId: string; chunk: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { runId: string; chunk: string }) => {
      handler(payload)
    }
    ipcRenderer.on('runs:output', listener)
    return () => ipcRenderer.removeListener('runs:output', listener)
  },
  onRunStatus: (handler: (payload: { runId: string; status: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { runId: string; status: string }) => {
      handler(payload)
    }
    ipcRenderer.on('runs:status', listener)
    return () => ipcRenderer.removeListener('runs:status', listener)
  },

  getChains: () => ipcRenderer.invoke('chains:list'),
  addChain: (chain: {
    name: string
    description?: string
    projectId?: string
    steps: Array<{ id: string; commandId: string; variables?: Record<string, string>; delayMs?: number }>
    stopOnFailure: boolean
    parallel?: boolean
  }) => ipcRenderer.invoke('chains:create', chain),
  updateChain: (id: string, updates: {
    name: string
    description?: string
    projectId?: string
    steps: Array<{ id: string; commandId: string; variables?: Record<string, string>; delayMs?: number }>
    stopOnFailure: boolean
    parallel?: boolean
  }) => ipcRenderer.invoke('chains:update', id, updates),
  removeChain: (id: string) => ipcRenderer.invoke('chains:delete', id),
  runChain: (id: string, projectId?: string) => ipcRenderer.invoke('chains:run', id, projectId),
  onChainProgress: (handler: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      handler(payload)
    }
    ipcRenderer.on('chains:progress', listener)
    return () => ipcRenderer.removeListener('chains:progress', listener)
  },

  getTriggers: () => ipcRenderer.invoke('triggers:list'),
  addTrigger: (trigger: {
    name: string
    description?: string
    projectId?: string
    chainId: string
    event: 'onProjectOpen' | 'afterContainerStart' | 'onStartup'
    enabled?: boolean
    requireConfirmation?: boolean
  }) => ipcRenderer.invoke('triggers:create', trigger),
  updateTrigger: (id: string, updates: {
    name: string
    description?: string
    projectId?: string
    chainId: string
    event: 'onProjectOpen' | 'afterContainerStart' | 'onStartup'
    enabled?: boolean
    requireConfirmation?: boolean
  }) => ipcRenderer.invoke('triggers:update', id, updates),
  removeTrigger: (id: string) => ipcRenderer.invoke('triggers:delete', id),
  notifyTriggerEvent: (event: 'onProjectOpen', payload: { projectId: string }) =>
    ipcRenderer.invoke('triggers:emit', event, payload),
  getPendingTriggerConfirmations: () => ipcRenderer.invoke('triggers:pending-confirmations'),
  respondToTriggerConfirmation: (requestId: string, approved: boolean) =>
    ipcRenderer.invoke('triggers:respond-confirmation', requestId, approved),
  onTriggerConfirmationRequested: (handler: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      handler(payload)
    }
    ipcRenderer.on('triggers:confirmation-requested', listener)
    return () => ipcRenderer.removeListener('triggers:confirmation-requested', listener)
  },

  // Containers
  getContainers: () => ipcRenderer.invoke('containers:get'),
  startContainer: (id: string) => ipcRenderer.invoke('containers:start', id),
  stopContainer: (id: string) => ipcRenderer.invoke('containers:stop', id),
  restartContainer: (id: string) => ipcRenderer.invoke('containers:restart', id),
  pauseContainer: (id: string) => ipcRenderer.invoke('containers:pause', id),
  unpauseContainer: (id: string) => ipcRenderer.invoke('containers:unpause', id),
  removeContainer: (id: string, force?: boolean) => ipcRenderer.invoke('containers:remove', id, force),
  getContainerLogs: (id: string) => ipcRenderer.invoke('containers:logs', id),
  subscribeContainerLogs: (id: string, tail?: number) => ipcRenderer.invoke('docker:logs:subscribe', id, tail),
  unsubscribeContainerLogs: (subscriptionId: string) =>
    ipcRenderer.invoke('docker:logs:unsubscribe', subscriptionId),
  onContainerLogsData: (handler: (payload: { subscriptionId: string; containerId: string; chunk: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { subscriptionId: string; containerId: string; chunk: string }
    ) => {
      handler(payload)
    }
    ipcRenderer.on('docker:logs:data', listener)
    return () => ipcRenderer.removeListener('docker:logs:data', listener)
  },
  onContainerLogsEnd: (handler: (payload: { subscriptionId: string; containerId: string; code: number | null }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { subscriptionId: string; containerId: string; code: number | null }
    ) => {
      handler(payload)
    }
    ipcRenderer.on('docker:logs:end', listener)
    return () => ipcRenderer.removeListener('docker:logs:end', listener)
  },
  onContainerLogsError: (handler: (payload: { subscriptionId: string; containerId: string; error: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { subscriptionId: string; containerId: string; error: string }
    ) => {
      handler(payload)
    }
    ipcRenderer.on('docker:logs:error', listener)
    return () => ipcRenderer.removeListener('docker:logs:error', listener)
  },

  // Run History
  getRunHistory: () => ipcRenderer.invoke('history:get'),
  listRecentHistory: (limit?: number) => ipcRenderer.invoke('history:listRecent', limit),
  getRunOutput: (runId: string) => ipcRenderer.invoke('history:output', runId),
  clearRunHistory: () => ipcRenderer.invoke('history:clear'),

  // Notes
  getNotes: (projectId: string) => ipcRenderer.invoke('notes:get', projectId),
  updateNotes: (projectId: string, notes: { setupSteps?: string; todos?: string; reminders?: string }) =>
    ipcRenderer.invoke('notes:update', projectId, notes),

  // Files
  listProjectFiles: (projectId: string, dir?: string) => ipcRenderer.invoke('files:list', projectId, dir),
  searchProjectFiles: (projectId: string, query: string, limit?: number) =>
    ipcRenderer.invoke('files:search', projectId, query, limit),
  openFileInEditor: (projectId: string, relativePath: string, line?: number, column?: number) =>
    ipcRenderer.invoke('files:openInEditor', projectId, relativePath, line, column),
  clearFileIndex: (projectId: string) => ipcRenderer.invoke('files:clearIndex', projectId),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type { ElectronAPI }
