/**
 * Re-export types from shared IPC module.
 * This keeps the renderer app types in sync with the IPC contract.
 */
export type {
  Project,
  ProjectType,
  Command,
  Container,
  RunHistoryEntry,
  RunStatus,
  ProjectNotes,
  RunOutputEvent,
  RunStatusEvent,
} from '../../../packages/shared/ipc';

