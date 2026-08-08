import { registerGitHandlers } from './git'
import { registerHistoryHandlers } from './history'
import { registerLlmHandlers } from './llm'
import { registerNotesHandlers } from './notes'
import { registerPreferenceHandlers } from './preferences'
import { registerShellHandlers } from './shell'

/**
 * Registers domain IPC modules that have been extracted from registerIpc.ts.
 * Remaining channels still register inside registerIpcHandlers().
 */
export function registerExtractedDomainHandlers(): void {
  registerPreferenceHandlers()
  registerNotesHandlers()
  registerHistoryHandlers()
  registerLlmHandlers()
  registerShellHandlers()
  registerGitHandlers()
}
