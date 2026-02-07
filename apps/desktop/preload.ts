import { contextBridge, ipcRenderer } from 'electron'

// Define the API interface
interface ElectronAPI {
  getProjects: () => Promise<unknown[]>
  listWslDistros: () => Promise<string[]>
  addProject: (path: string) => Promise<{ id: string; path: string }>
  removeProject: (id: string) => Promise<{ success: boolean }>
  updateProject: (id: string, updates: { name: string }) => Promise<{ id: string; name: string }>
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
  removeCommand: (id: string) => Promise<{ success: boolean }>
  getProjectDirectories: (projectId: string, relativePath?: string) => Promise<string[]>
  runCommand: (id: string, projectId?: string) => Promise<{ runId: string; status: string }>
  stopCommand: (runId: string) => Promise<{ success: boolean }>
  onRunOutput: (handler: (payload: { runId: string; chunk: string }) => void) => () => void
  onRunStatus: (handler: (payload: { runId: string; status: string }) => void) => () => void

  getContainers: () => Promise<unknown[]>
  startContainer: (id: string) => Promise<{ success: boolean }>
  stopContainer: (id: string) => Promise<{ success: boolean }>
  restartContainer: (id: string) => Promise<{ success: boolean }>
  pauseContainer: (id: string) => Promise<{ success: boolean }>
  unpauseContainer: (id: string) => Promise<{ success: boolean }>
  removeContainer: (id: string, force?: boolean) => Promise<{ success: boolean }>
  getContainerLogs: (id: string) => Promise<string>

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
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:get'),
  listWslDistros: () => ipcRenderer.invoke('wsl:list-distros'),
  addProject: (path: string) => ipcRenderer.invoke('projects:add', path),
  removeProject: (id: string) => ipcRenderer.invoke('projects:remove', id),
  updateProject: (id: string, updates: { name: string }) =>
    ipcRenderer.invoke('projects:update', id, updates),
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
  removeCommand: (id: string) => ipcRenderer.invoke('commands:remove', id),
  getProjectDirectories: (projectId: string, relativePath?: string) =>
    ipcRenderer.invoke('commands:get-directories', projectId, relativePath),
  runCommand: (id: string, projectId?: string) =>
    ipcRenderer.invoke('commands:run', id, projectId),
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

  // Containers
  getContainers: () => ipcRenderer.invoke('containers:get'),
  startContainer: (id: string) => ipcRenderer.invoke('containers:start', id),
  stopContainer: (id: string) => ipcRenderer.invoke('containers:stop', id),
  restartContainer: (id: string) => ipcRenderer.invoke('containers:restart', id),
  pauseContainer: (id: string) => ipcRenderer.invoke('containers:pause', id),
  unpauseContainer: (id: string) => ipcRenderer.invoke('containers:unpause', id),
  removeContainer: (id: string, force?: boolean) => ipcRenderer.invoke('containers:remove', id, force),
  getContainerLogs: (id: string) => ipcRenderer.invoke('containers:logs', id),

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
