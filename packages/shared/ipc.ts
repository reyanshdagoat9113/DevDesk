/**
 * Shared IPC types and contract between main and renderer processes.
 * This file is used by both preload.ts and renderer code.
 */

// ============================================================================
// Domain Types
// ============================================================================

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown';

export interface Project {
  id: string;
  name: string;
  path: string;
  type: ProjectType;
}

export interface Command {
  id: string;
  name: string;
  command: string;
  description: string;
  tags: string[];
}

export interface Container {
  id: string;
  name: string;
  state: 'running' | 'stopped' | 'paused';
  ports?: string[];
}

export type RunStatus = 'running' | 'success' | 'failed' | 'stopped';

export interface RunHistoryEntry {
  id: string;
  commandId?: string;
  command: string;
  status: RunStatus;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  projectId?: string;
  output: string;
}

export interface ProjectNotes {
  projectId: string;
  ports: string[];
  urls: string[];
  reminders: string[];
}

// ============================================================================
// Request/Response Types
// ============================================================================

// --- Projects ---

export interface ListProjectsRequest {
  /** Optional filter to only return projects of specific type */
  type?: ProjectType;
}

export interface ListProjectsResponse {
  projects: Project[];
}

export interface AddProjectRequest {
  /** Display name for the project */
  name: string;
  /** Absolute path to the project directory */
  path: string;
  /** Optional: force a specific type instead of auto-detection */
  type?: ProjectType;
}

export interface AddProjectResponse {
  project: Project;
}

export interface RemoveProjectRequest {
  /** Project ID to remove */
  id: string;
}

export interface RemoveProjectResponse {
  success: boolean;
}

// --- Commands ---

export interface ListCommandsRequest {
  /** Optional: filter to commands for a specific project */
  projectId?: string;
  /** Optional: filter by tag */
  tag?: string;
}

export interface ListCommandsResponse {
  commands: Command[];
}

export interface AddCommandRequest {
  name: string;
  command: string;
  description: string;
  tags: string[];
  /** Optional: associate with a specific project */
  projectId?: string;
}

export interface AddCommandResponse {
  command: Command;
}

export interface RemoveCommandRequest {
  id: string;
}

export interface RemoveCommandResponse {
  success: boolean;
}

export interface RunCommandRequest {
  /** Command ID to run (or use rawCommand) */
  commandId?: string;
  /** Raw command string (alternative to commandId) */
  rawCommand?: string;
  /** Optional: run in context of a specific project */
  projectId?: string;
  /** Optional: variables to substitute in command template */
  variables?: Record<string, string>;
}

export interface RunCommandResponse {
  runId: string;
  status: RunStatus;
}

export interface StopCommandRequest {
  /** Run ID to stop */
  runId: string;
}

export interface StopCommandResponse {
  success: boolean;
}

// --- Containers (Docker) ---

export interface ListContainersRequest {
  /** Optional: filter by state */
  state?: 'running' | 'stopped' | 'paused' | 'all';
}

export interface ListContainersResponse {
  containers: Container[];
}

export interface StartContainerRequest {
  /** Container ID or name */
  id: string;
}

export interface StartContainerResponse {
  success: boolean;
}

export interface StopContainerRequest {
  /** Container ID or name */
  id: string;
}

export interface StopContainerResponse {
  success: boolean;
}

export interface GetContainerLogsRequest {
  /** Container ID or name */
  id: string;
  /** Number of lines from the end (default: 100) */
  tail?: number;
}

export interface GetContainerLogsResponse {
  logs: string;
}

// --- Run History ---

export interface ListRunHistoryRequest {
  /** Optional: filter by status */
  status?: RunStatus;
  /** Optional: filter by project */
  projectId?: string;
  /** Maximum number of entries to return (default: 50) */
  limit?: number;
}

export interface ListRunHistoryResponse {
  entries: RunHistoryEntry[];
}

export interface GetRunOutputRequest {
  /** Run ID to get output for */
  runId: string;
}

export interface GetRunOutputResponse {
  output: string;
}

// --- Project Notes ---

export interface GetProjectNotesRequest {
  projectId: string;
}

export interface GetProjectNotesResponse {
  notes: ProjectNotes;
}

export interface UpdateProjectNotesRequest {
  projectId: string;
  ports: string[];
  urls: string[];
  reminders: string[];
}

export interface UpdateProjectNotesResponse {
  notes: ProjectNotes;
}

// ============================================================================
// Event Channel Types (for streaming/emitted events)
// ============================================================================

export interface RunOutputEvent {
  runId: string;
  output: string;
  timestamp: number;
}

export interface RunStatusEvent {
  runId: string;
  status: RunStatus;
  exitCode?: number;
  timestamp: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface IPCError {
  message: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// Channel Names (const for type safety)
// ============================================================================

export const IPC_CHANNELS = {
  // Request/response channels (invoke/handle)
  PROJECTS_LIST: 'projects:list',
  PROJECTS_ADD: 'projects:add',
  PROJECTS_REMOVE: 'projects:remove',

  COMMANDS_LIST: 'commands:list',
  COMMANDS_ADD: 'commands:add',
  COMMANDS_REMOVE: 'commands:remove',
  COMMANDS_RUN: 'commands:run',
  COMMANDS_STOP: 'commands:stop',

  CONTAINERS_LIST: 'containers:list',
  CONTAINERS_START: 'containers:start',
  CONTAINERS_STOP: 'containers:stop',
  CONTAINERS_GET_LOGS: 'containers:get-logs',

  HISTORY_LIST: 'history:list',
  HISTORY_GET_OUTPUT: 'history:get-output',

  NOTES_GET: 'notes:get',
  NOTES_UPDATE: 'notes:update',

  // Event channels (send/on)
  EVENT_RUN_OUTPUT: 'event:run-output',
  EVENT_RUN_STATUS: 'event:run-status',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
export type IPCRequestChannel = Exclude<IPCChannel, `event:${string}`>;
export type IPCEventChannel = Extract<IPCChannel, `event:${string}`>;

// ============================================================================
// Type Mappings
// ============================================================================

export type IPCRequestHandlers = {
  [IPC_CHANNELS.PROJECTS_LIST]: (req: ListProjectsRequest) => Promise<ListProjectsResponse>;
  [IPC_CHANNELS.PROJECTS_ADD]: (req: AddProjectRequest) => Promise<AddProjectResponse>;
  [IPC_CHANNELS.PROJECTS_REMOVE]: (req: RemoveProjectRequest) => Promise<RemoveProjectResponse>;

  [IPC_CHANNELS.COMMANDS_LIST]: (req: ListCommandsRequest) => Promise<ListCommandsResponse>;
  [IPC_CHANNELS.COMMANDS_ADD]: (req: AddCommandRequest) => Promise<AddCommandResponse>;
  [IPC_CHANNELS.COMMANDS_REMOVE]: (req: RemoveCommandRequest) => Promise<RemoveCommandResponse>;
  [IPC_CHANNELS.COMMANDS_RUN]: (req: RunCommandRequest) => Promise<RunCommandResponse>;
  [IPC_CHANNELS.COMMANDS_STOP]: (req: StopCommandRequest) => Promise<StopCommandResponse>;

  [IPC_CHANNELS.CONTAINERS_LIST]: (req: ListContainersRequest) => Promise<ListContainersResponse>;
  [IPC_CHANNELS.CONTAINERS_START]: (req: StartContainerRequest) => Promise<StartContainerResponse>;
  [IPC_CHANNELS.CONTAINERS_STOP]: (req: StopContainerRequest) => Promise<StopContainerResponse>;
  [IPC_CHANNELS.CONTAINERS_GET_LOGS]: (req: GetContainerLogsRequest) => Promise<GetContainerLogsResponse>;

  [IPC_CHANNELS.HISTORY_LIST]: (req: ListRunHistoryRequest) => Promise<ListRunHistoryResponse>;
  [IPC_CHANNELS.HISTORY_GET_OUTPUT]: (req: GetRunOutputRequest) => Promise<GetRunOutputResponse>;

  [IPC_CHANNELS.NOTES_GET]: (req: GetProjectNotesRequest) => Promise<GetProjectNotesResponse>;
  [IPC_CHANNELS.NOTES_UPDATE]: (req: UpdateProjectNotesRequest) => Promise<UpdateProjectNotesResponse>;
};

export type IPCEventListenerMap = {
  [IPC_CHANNELS.EVENT_RUN_OUTPUT]: (event: RunOutputEvent) => void;
  [IPC_CHANNELS.EVENT_RUN_STATUS]: (event: RunStatusEvent) => void;
};
