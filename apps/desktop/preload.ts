import { contextBridge, ipcRenderer } from 'electron'

// Define the API interface
interface ElectronAPI {
  getProjects: () => Promise<unknown[]>
  addProject: (path: string) => Promise<{ id: string; path: string }>
  removeProject: (id: string) => Promise<{ success: boolean }>
  openProjectFolderDialog: () => Promise<{ canceled: boolean; path?: string }>
  openProjectFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInEditor: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInTerminal: (id: string) => Promise<{ success: boolean; error?: string }>
  getPreferences: () => Promise<{ editor: { id: string; command?: string }; terminal: { id: string; command?: string } }>
  updatePreferences: (preferences: {
    editor?: { id: string; command?: string }
    terminal?: { id: string; command?: string }
  }) => Promise<{ success: boolean }>

  getCommands: () => Promise<unknown[]>
  addCommand: (command: { name: string; command: string; description?: string; tags?: string[] }) => Promise<{ id: string }>
  runCommand: (id: string, projectId?: string) => Promise<{ runId: string; status: string }>
  stopCommand: (runId: string) => Promise<{ success: boolean }>
  onRunOutput: (handler: (payload: { runId: string; chunk: string }) => void) => () => void
  onRunStatus: (handler: (payload: { runId: string; status: string }) => void) => () => void

  getContainers: () => Promise<unknown[]>
  startContainer: (id: string) => Promise<{ success: boolean }>
  stopContainer: (id: string) => Promise<{ success: boolean }>
  getContainerLogs: (id: string) => Promise<string>

  getRunHistory: () => Promise<unknown[]>
  getRunOutput: (runId: string) => Promise<string>

  getNotes: (projectId: string) => Promise<{ ports: string; urls: string; reminders: string }>
  updateNotes: (projectId: string, notes: { ports?: string; urls?: string; reminders?: string }) => Promise<{ success: boolean }>
}

// Expose a safe API to the renderer process
const electronAPI: ElectronAPI = {
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:get'),
  addProject: (path: string) => ipcRenderer.invoke('projects:add', path),
  removeProject: (id: string) => ipcRenderer.invoke('projects:remove', id),
  openProjectFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),
  openProjectFolder: (id: string) => ipcRenderer.invoke('projects:open-folder', id),
  openProjectInEditor: (id: string) => ipcRenderer.invoke('projects:open-editor', id),
  openProjectInTerminal: (id: string) => ipcRenderer.invoke('projects:open-terminal', id),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  updatePreferences: (preferences: { editor?: { id: string; command?: string }; terminal?: { id: string; command?: string } }) =>
    ipcRenderer.invoke('preferences:update', preferences),

  // Commands
  getCommands: () => ipcRenderer.invoke('commands:get'),
  addCommand: (command: { name: string; command: string; description?: string; tags?: string[] }) =>
    ipcRenderer.invoke('commands:add', command),
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
  getContainerLogs: (id: string) => ipcRenderer.invoke('containers:logs', id),

  // Run History
  getRunHistory: () => ipcRenderer.invoke('history:get'),
  getRunOutput: (runId: string) => ipcRenderer.invoke('history:output', runId),

  // Notes
  getNotes: (projectId: string) => ipcRenderer.invoke('notes:get', projectId),
  updateNotes: (projectId: string, notes: { ports?: string; urls?: string; reminders?: string }) =>
    ipcRenderer.invoke('notes:update', projectId, notes),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type { ElectronAPI }
