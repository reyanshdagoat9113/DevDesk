import type { AppPreferences, Command, Container, EngineIndexMeta, EngineSearchSession, Project, ProjectNotes, RunHistoryEntry } from '../types'
import type {
  EngineIndexResult,
  EngineSearchResult,
  EngineStats,
  EngineStatus,
} from '../../../desktop/engine/types'

export interface ElectronAPI {
  getProjects: () => Promise<Project[]>
  listWslDistros: () => Promise<string[]>
  addProject: (path: string) => Promise<Project>
  removeProject: (id: string) => Promise<{ success: boolean }>
  updateProject: (id: string, updates: { name: string }) => Promise<Project>
  openProjectFolderDialog: (startPath?: string) => Promise<{ canceled: boolean; path?: string }>
  openProjectFolder: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectFileInFolder: (id: string, relativePath: string) => Promise<{ success: boolean; error?: string }>
  openProjectInEditor: (id: string) => Promise<{ success: boolean; error?: string }>
  openProjectFileInEditor: (
    id: string,
    relativePath: string,
    location?: { line?: number; column?: number }
  ) => Promise<{ success: boolean; error?: string }>
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
  restartContainer: (id: string) => Promise<{ success: boolean }>
  pauseContainer: (id: string) => Promise<{ success: boolean }>
  unpauseContainer: (id: string) => Promise<{ success: boolean }>
  removeContainer: (id: string, force?: boolean) => Promise<{ success: boolean }>
  getContainerLogs: (id: string) => Promise<string>

  getRunHistory: () => Promise<RunHistoryEntry[]>
  getRunOutput: (runId: string) => Promise<string>
  clearRunHistory: () => Promise<{ success: boolean }>

  getNotes: (projectId: string) => Promise<ProjectNotes>
  updateNotes: (projectId: string, notes: Partial<ProjectNotes>) => Promise<{ success: boolean }>

  engineStatus: () => Promise<EngineStatus>
  engineIndexes: () => Promise<Record<string, EngineIndexMeta>>
  engineSearchSessions: () => Promise<Record<string, EngineSearchSession>>
  clearEngineSearchSession: (projectId: string) => Promise<{ success: boolean }>
  engineIndex: (projectId: string) => Promise<EngineIndexResult>
  engineSearch: (projectId: string, query: string, options?: { regex?: boolean; limit?: number }) => Promise<EngineSearchResult>
  engineStats: (projectId: string) => Promise<EngineStats>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
