import { shell } from 'electron'
import { getProjectById } from '../../data/store'
import { assertSafeExternalUrl, handleTrusted } from '../trustedIpc'

/** Domain registrar: git workflow channels. */
export function registerGitHandlers(): void {
  handleTrusted('git:get-state', async (_event, projectId: string) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const { getGitWorkflowState } = await import('../../git/service')
    return getGitWorkflowState(project.path)
  })

  handleTrusted('git:commit', async (_event, projectId: string, message: string) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const { commitAllChanges } = await import('../../git/service')
    return commitAllChanges(project.path, message)
  })

  handleTrusted('git:push', async (_event, projectId: string) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const { pushCurrentBranch } = await import('../../git/service')
    return pushCurrentBranch(project.path)
  })

  handleTrusted('git:create-pr', async (
    _event,
    projectId: string,
    input: {
      title: string
      body: string
      isDraft: boolean
      baseBranch?: string
    },
  ) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const { createPullRequest } = await import('../../git/service')
    const result = await createPullRequest(project.path, input)
    if (result.ok && result.url) {
      await shell.openExternal(assertSafeExternalUrl(result.url))
    }
    return result
  })

  handleTrusted('git:diff', async (_event, projectId: string, relativePath: string) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }
    if (!relativePath?.trim()) {
      throw new Error('File path is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const { getFileDiff } = await import('../../git/service')
    return getFileDiff(project.path, relativePath)
  })
}
