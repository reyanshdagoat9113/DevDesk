import { bundleLlmContext, type LlmBundleOptions } from '../../llm/bundler'
import { handleTrusted } from '../trustedIpc'

/** Domain registrar: LLM context bundling. */
export function registerLlmHandlers(): void {
  handleTrusted('llm:bundle-context', async (_event, projectId: string, options?: LlmBundleOptions) => {
    return bundleLlmContext(projectId, options)
  })
}
