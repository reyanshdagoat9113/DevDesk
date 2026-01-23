import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  type IPCRequestHandlers,
  type IPCEventListenerMap,
  type ListProjectsRequest,
  type ListProjectsResponse,
  type AddProjectRequest,
  type AddProjectResponse,
  type RemoveProjectRequest,
  type RemoveProjectResponse,
  type ListCommandsRequest,
  type ListCommandsResponse,
  type AddCommandRequest,
  type AddCommandResponse,
  type RemoveCommandRequest,
  type RemoveCommandResponse,
  type RunCommandRequest,
  type RunCommandResponse,
  type StopCommandRequest,
  type StopCommandResponse,
  type ListContainersRequest,
  type ListContainersResponse,
  type StartContainerRequest,
  type StartContainerResponse,
  type StopContainerRequest as StopContainerReq,
  type StopContainerResponse as StopContainerRes,
  type GetContainerLogsRequest,
  type GetContainerLogsResponse,
  type ListRunHistoryRequest,
  type ListRunHistoryResponse,
  type GetRunOutputRequest,
  type GetRunOutputResponse,
  type GetProjectNotesRequest,
  type GetProjectNotesResponse,
  type UpdateProjectNotesRequest,
  type UpdateProjectNotesResponse,
  type RunOutputEvent,
  type RunStatusEvent,
} from '../shared/ipc';

// Valid channels for request/response (invoke/handle)
const VALID_INVOKE_CHANNELS = Object.values(IPC_CHANNELS).filter(
  (ch) => !ch.startsWith('event:')
);

// Valid channels for events (send/on)
const VALID_EVENT_CHANNELS = Object.values(IPC_CHANNELS).filter((ch) =>
  ch.startsWith('event:')
);

// ============================================================================
// Request/Response API (typed methods)
// ============================================================================

const projects = {
  list: (req?: ListProjectsRequest): Promise<ListProjectsResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST, req ?? {}),
  add: (req: AddProjectRequest): Promise<AddProjectResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_ADD, req),
  remove: (req: RemoveProjectRequest): Promise<RemoveProjectResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_REMOVE, req),
};

const commands = {
  list: (req?: ListCommandsRequest): Promise<ListCommandsResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMANDS_LIST, req ?? {}),
  add: (req: AddCommandRequest): Promise<AddCommandResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMANDS_ADD, req),
  remove: (req: RemoveCommandRequest): Promise<RemoveCommandResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMANDS_REMOVE, req),
  run: (req: RunCommandRequest): Promise<RunCommandResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMANDS_RUN, req),
  stop: (req: StopCommandRequest): Promise<StopCommandResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMANDS_STOP, req),
};

const containers = {
  list: (req?: ListContainersRequest): Promise<ListContainersResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS_LIST, req ?? {}),
  start: (req: StartContainerRequest): Promise<StartContainerResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS_START, req),
  stop: (req: StopContainerReq): Promise<StopContainerRes> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS_STOP, req),
  getLogs: (req: GetContainerLogsRequest): Promise<GetContainerLogsResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS_GET_LOGS, req),
};

const history = {
  list: (req?: ListRunHistoryRequest): Promise<ListRunHistoryResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, req ?? {}),
  getOutput: (req: GetRunOutputRequest): Promise<GetRunOutputResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_OUTPUT, req),
};

const notes = {
  get: (req: GetProjectNotesRequest): Promise<GetProjectNotesResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTES_GET, req),
  update: (req: UpdateProjectNotesRequest): Promise<UpdateProjectNotesResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.NOTES_UPDATE, req),
};

// ============================================================================
// Event Listener API
// ============================================================================

type CleanupFn = () => void;

const events = {
  onRunOutput: (callback: (event: RunOutputEvent) => void): CleanupFn => {
    const handler = (_event: IpcRendererEvent, data: RunOutputEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EVENT_RUN_OUTPUT, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_RUN_OUTPUT, handler);
    };
  },

  onRunStatus: (callback: (event: RunStatusEvent) => void): CleanupFn => {
    const handler = (_event: IpcRendererEvent, data: RunStatusEvent) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.EVENT_RUN_STATUS, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_RUN_STATUS, handler);
    };
  },

  // Cleanup all event listeners
  removeAllListeners: (): void => {
    for (const channel of VALID_EVENT_CHANNELS) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
};

// ============================================================================
// Expose API to Renderer
// ============================================================================

const api = {
  platform: process.platform,
  projects,
  commands,
  containers,
  history,
  notes,
  events,
};

contextBridge.exposeInMainWorld('electronAPI', api);
