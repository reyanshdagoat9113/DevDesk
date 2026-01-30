import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getStore, updateStore } from '../data/store'
import { detectProjectType, getProjectIcon } from '../projects/detectProjectType'
import type { AppPreference, AppPreferences, RunStatus } from '../data/model'

type RunningCommand = {
  process: ChildProcessWithoutNullStreams
  output: string
  requestedStop: boolean
}

const runningCommands = new Map<string, RunningCommand>()

function broadcast(channel: string, payload: unknown) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
}

const MAC_EDITOR_APPS: Record<string, string> = {
  vscode: 'Visual Studio Code',
  cursor: 'Cursor',
  webstorm: 'WebStorm',
  intellij: 'IntelliJ IDEA',
  sublime: 'Sublime Text',
  xcode: 'Xcode',
}

const MAC_TERMINAL_APPS: Record<string, string> = {
  terminal: 'Terminal',
  iterm: 'iTerm',
  warp: 'Warp',
  hyper: 'Hyper',
}

const WINDOWS_EDITOR_COMMANDS: Record<string, { command: string; args: (projectPath: string) => string[] }> = {
  vscode: { command: 'code', args: (projectPath) => [projectPath] },
  'visual-studio': { command: 'devenv', args: (projectPath) => [projectPath] },
}

const WINDOWS_TERMINAL_COMMANDS: Record<string, { command: string; args: (projectPath: string) => string[] }> = {
  'windows-terminal': { command: 'wt', args: (projectPath) => ['-d', projectPath] },
  powershell: {
    command: 'powershell',
    args: (projectPath) => ['-NoExit', '-Command', `Set-Location -LiteralPath "${projectPath}"`],
  },
  cmd: { command: 'cmd.exe', args: (projectPath) => ['/k', `cd /d "${projectPath}"`] },
}

async function getProjectPath(projectId: string): Promise<string> {
  if (!projectId) {
    throw new Error('Project not found.')
  }
  const store = await getStore()
  const project = store.projects.find((entry) => entry.id === projectId)
  if (!project) {
    throw new Error('Project not found.')
  }
  if (!fs.existsSync(project.path)) {
    throw new Error('Project path does not exist.')
  }
  return project.path
}

async function getPreferences(): Promise<AppPreferences> {
  const store = await getStore()
  return store.preferences
}

function spawnDetached(command: string, args: string[]) {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.on('error', (error) => resolve({ success: false, error: error.message }))
      child.on('spawn', () => {
        child.unref()
        resolve({ success: true })
      })
    } catch (error) {
      resolve({ success: false, error: error instanceof Error ? error.message : 'Failed to start process.' })
    }
  })
}

function spawnShellDetached(command: string) {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    try {
      const child = spawn(command, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true,
      })
      child.on('error', (error) => resolve({ success: false, error: error.message }))
      child.on('spawn', () => {
        child.unref()
        resolve({ success: true })
      })
    } catch (error) {
      resolve({ success: false, error: error instanceof Error ? error.message : 'Failed to start process.' })
    }
  })
}

function resolveCustomCommand(preference: AppPreference, projectPath: string) {
  if (!preference.command) {
    return { success: false, error: 'Custom command is required.' }
  }
  const command = preference.command.includes('{path}')
    ? preference.command.split('{path}').join(`"${projectPath}"`)
    : `${preference.command} "${projectPath}"`
  return spawnShellDetached(command)
}

function getProjectName(projectPath: string): string {
  const normalized = projectPath.endsWith(path.sep) ? projectPath.slice(0, -1) : projectPath
  return path.basename(normalized)
}

// Register all IPC handlers
export function registerIpcHandlers() {
  ipcMain.handle('dialog:open-folder', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Select Project Folder',
      properties: ['openDirectory'],
    }
    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    return { canceled: false, path: result.filePaths[0] }
  })
  // Projects
  ipcMain.handle('projects:get', async () => {
    const store = await getStore()
    return store.projects
  })

  ipcMain.handle('projects:add', async (_event, path: string) => {
    if (!path || typeof path !== 'string') {
      throw new Error('Project path is required.')
    }

    if (!fs.existsSync(path)) {
      throw new Error('Project path does not exist.')
    }

    const store = await getStore()
    const existing = store.projects.find((project) => project.path === path)
    if (existing) {
      return existing
    }

    const type = detectProjectType(path)
    const nextProject = {
      id: randomUUID(),
      path,
      name: getProjectName(path),
      type,
      icon: getProjectIcon(type),
    }

    await updateStore((draft) => {
      draft.projects.push(nextProject)
    })

    return nextProject
  })

  ipcMain.handle('projects:remove', async (_event, _id: string) => {
    if (!_id) {
      return { success: false }
    }

    await updateStore((draft) => {
      draft.projects = draft.projects.filter((project) => project.id !== _id)
      draft.runHistory = draft.runHistory.filter((entry) => entry.projectId !== _id)
      delete draft.notes[_id]
    })

    return { success: true }
  })

  ipcMain.handle('preferences:get', async () => {
    return getPreferences()
  })

  ipcMain.handle('preferences:update', async (_event, updates: Partial<AppPreferences>) => {
    await updateStore((draft) => {
      const current = draft.preferences
      draft.preferences = {
        editor: {
          id: updates?.editor?.id ?? current.editor.id,
          command: updates?.editor?.command ?? current.editor.command,
        },
        terminal: {
          id: updates?.terminal?.id ?? current.terminal.id,
          command: updates?.terminal?.command ?? current.terminal.command,
        },
      }
    })
    return { success: true }
  })

  ipcMain.handle('projects:open-folder', async (_event, _id: string) => {
    const projectPath = await getProjectPath(_id)
    const result = await shell.openPath(projectPath)
    if (result) {
      return { success: false, error: result }
    }
    return { success: true }
  })

  ipcMain.handle('projects:open-editor', async (_event, _id: string) => {
    const projectPath = await getProjectPath(_id)
    const preferences = await getPreferences()
    const preference = preferences.editor
    if (preference.id === 'custom') {
      return resolveCustomCommand(preference, projectPath)
    }
    if (process.platform === 'darwin') {
      const appName = MAC_EDITOR_APPS[preference.id] ?? MAC_EDITOR_APPS.vscode
      return spawnDetached('open', ['-a', appName, projectPath])
    }
    if (process.platform === 'win32') {
      const command = WINDOWS_EDITOR_COMMANDS[preference.id] ?? WINDOWS_EDITOR_COMMANDS.vscode
      return spawnDetached(command.command, command.args(projectPath))
    }
    return spawnDetached('code', [projectPath])
  })

  ipcMain.handle('projects:open-terminal', async (_event, _id: string) => {
    const projectPath = await getProjectPath(_id)
    const preferences = await getPreferences()
    const preference = preferences.terminal
    if (preference.id === 'custom') {
      return resolveCustomCommand(preference, projectPath)
    }
    if (process.platform === 'darwin') {
      const appName = MAC_TERMINAL_APPS[preference.id] ?? MAC_TERMINAL_APPS.terminal
      return spawnDetached('open', ['-a', appName, projectPath])
    }
    if (process.platform === 'win32') {
      const command = WINDOWS_TERMINAL_COMMANDS[preference.id] ?? WINDOWS_TERMINAL_COMMANDS['windows-terminal']
      return spawnDetached(command.command, command.args(projectPath))
    }
    return spawnDetached('x-terminal-emulator', ['--working-directory', projectPath])
  })

  // Commands
  ipcMain.handle('commands:get', async () => {
    const store = await getStore()
    return store.commands
  })

  ipcMain.handle(
    'commands:add',
    async (
      _event,
      command: { name: string; command: string; description?: string; tags?: string[] }
    ) => {
    if (!command?.name || !command?.command) {
      throw new Error('Command name and command are required.')
    }

    const nextCommand = {
      id: randomUUID(),
      name: command.name,
      command: command.command,
      description: command.description,
      tags: command.tags,
    }

    await updateStore((draft) => {
      draft.commands.push(nextCommand)
    })

    return nextCommand
    }
  )

  ipcMain.handle('commands:run', async (_event, _id: string, _projectId?: string) => {
    if (!_projectId) {
      throw new Error('Project is required to run a command.')
    }
    const store = await getStore()
    const command = store.commands.find((entry) => entry.id === _id)
    if (!command) {
      throw new Error('Command not found.')
    }

    const project = _projectId ? store.projects.find((entry) => entry.id === _projectId) : undefined
    if (_projectId && !project) {
      throw new Error('Project not found.')
    }

    const runId = randomUUID()
    const startTime = new Date().toISOString()

    await updateStore((draft) => {
      draft.runHistory.unshift({
        id: runId,
        commandId: command.id,
        projectId: project?.id,
        status: 'running',
        startTime,
        output: '',
      })
    })

    const child = spawn(command.command, {
      cwd: project?.path,
      shell: true,
      env: process.env,
    })

    const running: RunningCommand = {
      process: child,
      output: '',
      requestedStop: false,
    }
    runningCommands.set(runId, running)

    const flushOutput = async (runStatus?: RunStatus) => {
      const output = running.output
      await updateStore((draft) => {
        const entry = draft.runHistory.find((item) => item.id === runId)
        if (!entry) return
        entry.output = output
        if (runStatus) {
          entry.status = runStatus
          entry.endTime = new Date().toISOString()
        }
      })
    }

    const pushChunk = (chunk: Buffer) => {
      const text = chunk.toString()
      running.output += text
      broadcast('runs:output', { runId, chunk: text })
    }

    child.stdout.on('data', pushChunk)
    child.stderr.on('data', pushChunk)

    child.on('error', async (error) => {
      running.output += `\n${error.message}\n`
      await flushOutput('failed')
      runningCommands.delete(runId)
      broadcast('runs:status', { runId, status: 'failed' })
    })

    child.on('close', async (code) => {
      const status: RunStatus =
        running.requestedStop ? 'stopped' : code === 0 ? 'success' : 'failed'
      await flushOutput(status)
      runningCommands.delete(runId)
      broadcast('runs:status', { runId, status })
    })

    return { runId, status: 'running' }
  })

  ipcMain.handle('commands:stop', async (_event, _runId: string) => {
    const running = runningCommands.get(_runId)
    if (!running) {
      return { success: false }
    }

    running.requestedStop = true
    running.process.kill()
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
    const store = await getStore()
    return store.runHistory
  })

  ipcMain.handle('history:output', async (_event, _runId: string) => {
    const running = runningCommands.get(_runId)
    if (running) {
      return running.output
    }
    const store = await getStore()
    return store.runHistory.find((entry) => entry.id === _runId)?.output ?? ''
  })

  // Notes
  ipcMain.handle('notes:get', async (_event, _projectId: string) => {
    const store = await getStore()
    return (
      store.notes[_projectId] ?? {
        projectId: _projectId,
        ports: '',
        urls: '',
        reminders: '',
      }
    )
  })

  ipcMain.handle('notes:update', async (_event, _projectId: string, _notes: unknown) => {
    if (!_projectId) {
      return { success: false }
    }

    const updates = typeof _notes === 'object' && _notes ? (_notes as Partial<{ ports: string; urls: string; reminders: string }>) : {}

    await updateStore((draft) => {
      const current = draft.notes[_projectId] ?? {
        projectId: _projectId,
        ports: '',
        urls: '',
        reminders: '',
      }
      draft.notes[_projectId] = {
        projectId: _projectId,
        ports: updates.ports ?? current.ports,
        urls: updates.urls ?? current.urls,
        reminders: updates.reminders ?? current.reminders,
      }
    })

    return { success: true }
  })
}
