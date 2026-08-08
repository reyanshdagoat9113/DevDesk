import { ipcMain, shell } from 'electron'
import { getProjectById } from '../../data/store'

/** Domain registrar: git workflow channels. */
export function registerGitHandlers(): void {
  ipcMain.handle('git:get-state', async (_event, projectId: string) => {
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

  ipcMain.handle('git:commit', async (_event, projectId: string, message: string) => {
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

  ipcMain.handle('git:push', async (_event, projectId: string) => {
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

  ipcMain.handle('git:create-pr', async (
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
      await shell.openExternal(result.url)
    }
    return result
  })

  ipcMain.handle('git:diff', async (_event, projectId: string, relativePath: string) => {
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
