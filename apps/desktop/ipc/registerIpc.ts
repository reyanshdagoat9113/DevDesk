/**
 * IPC Handler Registration
 *
 * Registers all IPC channels for communication between main and renderer processes.
 * Uses ipcMain.handle() for request/response channels and ipcMain.on() for events.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'crypto';
import type { BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  type IPCRequestHandlers,
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
} from '../../../packages/shared/ipc';

// ============================================================================
// Error Serialization
// ============================================================================

interface SerializedError {
  message: string;
  code?: string;
  stack?: string;
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as { code?: string }).code,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

// ============================================================================
// Handler Wrappers (Safety & Logging)
// ============================================================================

// The actual handler functions we write have this signature:
// (event, req) => Promise<Response>
// This matches what ipcMain.handle() expects
function wrapHandler<T extends keyof IPCRequestHandlers & string>(
  channel: T,
  handler: (
    event: IpcMainInvokeEvent,
    req: Parameters<IPCRequestHandlers[T]>[0]
  ) => ReturnType<IPCRequestHandlers[T]>
): (
  event: IpcMainInvokeEvent,
  req: Parameters<IPCRequestHandlers[T]>[0]
) => ReturnType<IPCRequestHandlers[T]> {
  return (event, req) => {
    try {
      // Input validation - ensure request is an object
      if (req && typeof req !== 'object') {
        throw new Error(`Invalid request type for channel ${channel}`);
      }

      // Log request (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[IPC] ${channel}:`, req);
      }

      // Execute handler
      return handler(event, req)
        .then((result) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[IPC] ${channel} ->`, result);
          }
          return result;
        })
        .catch((error) => {
          console.error(`[IPC] Error in ${channel}:`, error);
          throw serializeError(error);
        }) as ReturnType<IPCRequestHandlers[T]>;
    } catch (error) {
      console.error(`[IPC] Error in ${channel}:`, error);
      throw serializeError(error);
    }
  };
}

// ============================================================================
// Stub Handlers (Return empty/mock data for MVP)
// ============================================================================

// Projects handlers
async function handleListProjects(_event: IpcMainInvokeEvent, _req: ListProjectsRequest): Promise<ListProjectsResponse> {
  // TODO: Implement actual project listing from storage
  return { projects: [] };
}

async function handleAddProject(_event: IpcMainInvokeEvent, req: AddProjectRequest): Promise<AddProjectResponse> {
  // TODO: Implement actual project addition with storage
  const { detectProjectType } = await import('../projects/detectProjectType');
  const detectedType = detectProjectType(req.path);
  const project = {
    id: randomUUID(),
    name: req.name,
    path: req.path,
    type: req.type ?? detectedType,
  };
  return { project };
}

async function handleRemoveProject(_event: IpcMainInvokeEvent, _req: RemoveProjectRequest): Promise<RemoveProjectResponse> {
  // TODO: Implement actual project removal from storage
  return { success: true };
}

// Commands handlers
async function handleListCommands(_event: IpcMainInvokeEvent, _req: ListCommandsRequest): Promise<ListCommandsResponse> {
  // TODO: Implement actual command listing from storage
  return { commands: [] };
}

async function handleAddCommand(_event: IpcMainInvokeEvent, _req: AddCommandRequest): Promise<AddCommandResponse> {
  // TODO: Implement actual command addition with storage
  const command = {
    id: randomUUID(),
    name: _req.name,
    command: _req.command,
    description: _req.description,
    tags: _req.tags,
  };
  return { command };
}

async function handleRemoveCommand(_event: IpcMainInvokeEvent, _req: RemoveCommandRequest): Promise<RemoveCommandResponse> {
  // TODO: Implement actual command removal from storage
  return { success: true };
}

async function handleRunCommand(_event: IpcMainInvokeEvent, _req: RunCommandRequest): Promise<RunCommandResponse> {
  // TODO: Implement actual command execution
  const runId = randomUUID();
  return {
    runId,
    status: 'running',
  };
}

async function handleStopCommand(_event: IpcMainInvokeEvent, _req: StopCommandRequest): Promise<StopCommandResponse> {
  // TODO: Implement actual command stopping
  return { success: true };
}

// Containers handlers
async function handleListContainers(_event: IpcMainInvokeEvent, _req: ListContainersRequest): Promise<ListContainersResponse> {
  // TODO: Implement actual Docker container listing
  // For now, return empty array with graceful degradation
  return { containers: [] };
}

async function handleStartContainer(_event: IpcMainInvokeEvent, _req: StartContainerRequest): Promise<StartContainerResponse> {
  // TODO: Implement actual Docker container start
  return { success: true };
}

async function handleStopContainer(_event: IpcMainInvokeEvent, _req: StopContainerReq): Promise<StopContainerRes> {
  // TODO: Implement actual Docker container stop
  return { success: true };
}

async function handleGetContainerLogs(_event: IpcMainInvokeEvent, _req: GetContainerLogsRequest): Promise<GetContainerLogsResponse> {
  // TODO: Implement actual Docker logs retrieval
  return { logs: '' };
}

// History handlers
async function handleListRunHistory(_event: IpcMainInvokeEvent, _req: ListRunHistoryRequest): Promise<ListRunHistoryResponse> {
  // TODO: Implement actual run history listing from storage
  return { entries: [] };
}

async function handleGetRunOutput(_event: IpcMainInvokeEvent, _req: GetRunOutputRequest): Promise<GetRunOutputResponse> {
  // TODO: Implement actual output retrieval from storage
  return { output: '' };
}

// Notes handlers
async function handleGetProjectNotes(_event: IpcMainInvokeEvent, _req: GetProjectNotesRequest): Promise<GetProjectNotesResponse> {
  // TODO: Implement actual notes retrieval from storage
  return {
    notes: {
      projectId: _req.projectId,
      ports: [],
      urls: [],
      reminders: [],
    },
  };
}

async function handleUpdateProjectNotes(_event: IpcMainInvokeEvent, _req: UpdateProjectNotesRequest): Promise<UpdateProjectNotesResponse> {
  // TODO: Implement actual notes update in storage
  return {
    notes: {
      projectId: _req.projectId,
      ports: _req.ports,
      urls: _req.urls,
      reminders: _req.reminders,
    },
  };
}

// ============================================================================
// Event Emitters (for sending events to renderer)
// ============================================================================

/**
 * Get the main window (if available) for sending events.
 * In a real app, you'd track the main window reference.
 */
function getMainWindow(): BrowserWindow | null {
  const windows = require('electron').BrowserWindow.getAllWindows() as BrowserWindow[];
  return windows[0] ?? null;
}

export const ipcEvents = {
  /**
   * Send run output event to renderer
   */
  sendRunOutput(event: RunOutputEvent): void {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.EVENT_RUN_OUTPUT, event);
    }
  },

  /**
   * Send run status change event to renderer
   */
  sendRunStatus(event: RunStatusEvent): void {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.EVENT_RUN_STATUS, event);
    }
  },
};

// ============================================================================
// Registration Function
// ============================================================================

/**
 * Register all IPC handlers.
 * Call this from main process after app is ready.
 */
export function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_LIST,
    wrapHandler(IPC_CHANNELS.PROJECTS_LIST, handleListProjects)
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_ADD,
    wrapHandler(IPC_CHANNELS.PROJECTS_ADD, handleAddProject)
  );
  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_REMOVE,
    wrapHandler(IPC_CHANNELS.PROJECTS_REMOVE, handleRemoveProject)
  );

  // Commands
  ipcMain.handle(
    IPC_CHANNELS.COMMANDS_LIST,
    wrapHandler(IPC_CHANNELS.COMMANDS_LIST, handleListCommands)
  );
  ipcMain.handle(
    IPC_CHANNELS.COMMANDS_ADD,
    wrapHandler(IPC_CHANNELS.COMMANDS_ADD, handleAddCommand)
  );
  ipcMain.handle(
    IPC_CHANNELS.COMMANDS_REMOVE,
    wrapHandler(IPC_CHANNELS.COMMANDS_REMOVE, handleRemoveCommand)
  );
  ipcMain.handle(
    IPC_CHANNELS.COMMANDS_RUN,
    wrapHandler(IPC_CHANNELS.COMMANDS_RUN, handleRunCommand)
  );
  ipcMain.handle(
    IPC_CHANNELS.COMMANDS_STOP,
    wrapHandler(IPC_CHANNELS.COMMANDS_STOP, handleStopCommand)
  );

  // Containers
  ipcMain.handle(
    IPC_CHANNELS.CONTAINERS_LIST,
    wrapHandler(IPC_CHANNELS.CONTAINERS_LIST, handleListContainers)
  );
  ipcMain.handle(
    IPC_CHANNELS.CONTAINERS_START,
    wrapHandler(IPC_CHANNELS.CONTAINERS_START, handleStartContainer)
  );
  ipcMain.handle(
    IPC_CHANNELS.CONTAINERS_STOP,
    wrapHandler(IPC_CHANNELS.CONTAINERS_STOP, handleStopContainer)
  );
  ipcMain.handle(
    IPC_CHANNELS.CONTAINERS_GET_LOGS,
    wrapHandler(IPC_CHANNELS.CONTAINERS_GET_LOGS, handleGetContainerLogs)
  );

  // History
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_LIST,
    wrapHandler(IPC_CHANNELS.HISTORY_LIST, handleListRunHistory)
  );
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_GET_OUTPUT,
    wrapHandler(IPC_CHANNELS.HISTORY_GET_OUTPUT, handleGetRunOutput)
  );

  // Notes
  ipcMain.handle(
    IPC_CHANNELS.NOTES_GET,
    wrapHandler(IPC_CHANNELS.NOTES_GET, handleGetProjectNotes)
  );
  ipcMain.handle(
    IPC_CHANNELS.NOTES_UPDATE,
    wrapHandler(IPC_CHANNELS.NOTES_UPDATE, handleUpdateProjectNotes)
  );

  console.log('[IPC] All handlers registered');
}

/**
 * Unregister all IPC handlers.
 * Call this when shutting down or during tests.
 */
export function unregisterIpcHandlers(): void {
  const allChannels = Object.values(IPC_CHANNELS);
  for (const channel of allChannels) {
    ipcMain.removeHandler(channel);
  }
  console.log('[IPC] All handlers unregistered');
}
