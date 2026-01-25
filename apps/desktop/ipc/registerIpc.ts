import { ipcMain } from 'electron'

// Register all IPC handlers
export function registerIpcHandlers() {
  // Projects
  ipcMain.handle('projects:get', async () => {
    return []
  })

  ipcMain.handle('projects:add', async (_event, path: string) => {
    return { id: '1', path }
  })

  ipcMain.handle('projects:remove', async (_event, _id: string) => {
    return { success: true }
  })

  // Commands
  ipcMain.handle('commands:get', async () => {
    return []
  })

  ipcMain.handle('commands:add', async (_event, command: { name: string; command: string; description?: string }) => {
    return { id: '1', ...command }
  })

  ipcMain.handle('commands:run', async (_event, _id: string, _projectId?: string) => {
    return { runId: '1', status: 'running' }
  })

  ipcMain.handle('commands:stop', async (_event, _runId: string) => {
    return { success: true }
  })

  // Containers
  ipcMain.handle('containers:get', async () => {
    return []
  })

  ipcMain.handle('containers:start', async (_event, _id: string) => {
    return { success: true }
  })

  ipcMain.handle('containers:stop', async (_event, _id: string) => {
    return { success: true }
  })

  ipcMain.handle('containers:logs', async (_event, _id: string) => {
    return ''
  })

  // Run History
  ipcMain.handle('history:get', async () => {
    return []
  })

  ipcMain.handle('history:output', async (_event, _runId: string) => {
    return ''
  })

  // Notes
  ipcMain.handle('notes:get', async (_event, _projectId: string) => {
    return { ports: '', urls: '', reminders: '' }
  })

  ipcMain.handle('notes:update', async (_event, _projectId: string, _notes: unknown) => {
    return { success: true }
  })
}
