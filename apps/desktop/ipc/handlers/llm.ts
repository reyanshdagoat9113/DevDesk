import { ipcMain } from 'electron'
import { bundleLlmContext, type LlmBundleOptions } from '../../llm/bundler'

/** Domain registrar: LLM context bundling. */
export function registerLlmHandlers(): void {
  ipcMain.handle('llm:bundle-context', async (_event, projectId: string, options?: LlmBundleOptions) => {
    return bundleLlmContext(projectId, options)
  })
}
