import type {
  Project,
  ProjectType,
  Command,
  Container,
  RunHistoryEntry,
  RunStatus,
  ProjectNotes,
  ListProjectsRequest,
  ListProjectsResponse,
  AddProjectRequest,
  AddProjectResponse,
  RemoveProjectRequest,
  RemoveProjectResponse,
  ListCommandsRequest,
  ListCommandsResponse,
  AddCommandRequest,
  AddCommandResponse,
  RemoveCommandRequest,
  RemoveCommandResponse,
  RunCommandRequest,
  RunCommandResponse,
  StopCommandRequest,
  StopCommandResponse,
  ListContainersRequest,
  ListContainersResponse,
  StartContainerRequest,
  StartContainerResponse,
  StopContainerRequest,
  StopContainerResponse,
  GetContainerLogsRequest,
  GetContainerLogsResponse,
  ListRunHistoryRequest,
  ListRunHistoryResponse,
  GetRunOutputRequest,
  GetRunOutputResponse,
  GetProjectNotesRequest,
  GetProjectNotesResponse,
  UpdateProjectNotesRequest,
  UpdateProjectNotesResponse,
  RunOutputEvent,
  RunStatusEvent,
} from '../../packages/shared/ipc';

// ============================================================================
// API Modules
// ============================================================================

interface ProjectsAPI {
  list: (req?: ListProjectsRequest) => Promise<ListProjectsResponse>;
  add: (req: AddProjectRequest) => Promise<AddProjectResponse>;
  remove: (req: RemoveProjectRequest) => Promise<RemoveProjectResponse>;
}

interface CommandsAPI {
  list: (req?: ListCommandsRequest) => Promise<ListCommandsResponse>;
  add: (req: AddCommandRequest) => Promise<AddCommandResponse>;
  remove: (req: RemoveCommandRequest) => Promise<RemoveCommandResponse>;
  run: (req: RunCommandRequest) => Promise<RunCommandResponse>;
  stop: (req: StopCommandRequest) => Promise<StopCommandResponse>;
}

interface ContainersAPI {
  list: (req?: ListContainersRequest) => Promise<ListContainersResponse>;
  start: (req: StartContainerRequest) => Promise<StartContainerResponse>;
  stop: (req: StopContainerRequest) => Promise<StopContainerResponse>;
  getLogs: (req: GetContainerLogsRequest) => Promise<GetContainerLogsResponse>;
}

interface HistoryAPI {
  list: (req?: ListRunHistoryRequest) => Promise<ListRunHistoryResponse>;
  getOutput: (req: GetRunOutputRequest) => Promise<GetRunOutputResponse>;
}

interface NotesAPI {
  get: (req: GetProjectNotesRequest) => Promise<GetProjectNotesResponse>;
  update: (req: UpdateProjectNotesRequest) => Promise<UpdateProjectNotesResponse>;
}

interface EventsAPI {
  onRunOutput: (callback: (event: RunOutputEvent) => void) => () => void;
  onRunStatus: (callback: (event: RunStatusEvent) => void) => () => void;
  removeAllListeners: () => void;
}

// ============================================================================
// Main ElectronAPI Interface
// ============================================================================

interface ElectronAPI {
  platform: string;
  projects: ProjectsAPI;
  commands: CommandsAPI;
  containers: ContainersAPI;
  history: HistoryAPI;
  notes: NotesAPI;
  events: EventsAPI;
}

// ============================================================================
// Global Declaration
// ============================================================================

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Re-export types for convenience
export type {
  Project,
  ProjectType,
  Command,
  Container,
  RunHistoryEntry,
  RunStatus,
  ProjectNotes,
};
