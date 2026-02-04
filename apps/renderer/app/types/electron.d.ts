import type { AppPreferences, Command, Container, Project, ProjectNotes, RunHistoryEntry } from '../types'

export interface ElectronAPI {
  getProjects: () => Promise<Project[]>
  addProject: (path: string) => Promise<Project>
  removeProject: (id: string) => Promise<{ success: boolean }>
  updateProject: (id: string, updates: { name: string }) => Promise<Project>
  openProjectFolderDialog: () => Promise<{ canceled: boolean; path?: string }>
  openProjectFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInEditor: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectInTerminal: (id: string) => Promise<{ success: boolean; error?: string }>
  getPreferences: () => Promise<AppPreferences>
  updatePreferences: (preferences: Partial<AppPreferences>) => Promise<{ success: boolean }>

  getCommands: () => Promise<Command[]>
  addCommand: (command: { name: string; command: string; description?: string; tags?: string[]; projectId?: string; workingDirectory?: string }) => Promise<Command>
  updateCommand: (id: string, updates: { name?: string; command?: string; description?: string; tags?: string[] }) => Promise<Command>
  removeCommand: (id: string) => Promise<{ success: boolean }>
  getProjectDirectories: (projectId: string, relativePath?: string) => Promise<string[]>
  runCommand: (id: string, projectId?: string) => Promise<{ runId: string; status: string }>
  stopCommand: (runId: string) => Promise<{ success: boolean }>
  onRunOutput: (handler: (payload: { runId: string; chunk: string }) => void) => () => void
  onRunStatus: (handler: (payload: { runId: string; status: string }) => void) => () => void

  getContainers: () => Promise<Container[]>
  startContainer: (id: string) => Promise<{ success: boolean }>
  stopContainer: (id: string) => Promise<{ success: boolean }>
  getContainerLogs: (id: string) => Promise<string>

  getRunHistory: () => Promise<RunHistoryEntry[]>
  getRunOutput: (runId: string) => Promise<string>
  clearRunHistory: () => Promise<{ success: boolean }>

  getNotes: (projectId: string) => Promise<ProjectNotes>
  updateNotes: (projectId: string, notes: Partial<ProjectNotes>) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
