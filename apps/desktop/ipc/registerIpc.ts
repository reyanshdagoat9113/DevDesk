import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getStore, updateStore } from '../data/store'
import { detectProjectType, getProjectIcon } from '../projects/detectProjectType'
import type { AppPreference, AppPreferences, Command, Container, Project, RunStatus } from '../data/model'

type RunningCommand = {
  process: ChildProcessWithoutNullStreams
  output: string
  requestedStop: boolean
}

const runningCommands = new Map<string, RunningCommand>()

type WslProjectLocation = {
  distro: string
  linuxPath: string
  uncPath: string
}

const WSL_UNC_PATH_PATTERN = /^\\\\wsl(?:\.localhost|\$)\\([^\\/]+)(?:[\\/](.*))?$/i

function resolveWslExecutablePath() {
  if (process.platform !== 'win32') {
    return 'wsl'
  }

  const windowsRoot = process.env.SystemRoot ?? process.env.windir ?? 'C:\\Windows'
  const candidates = [
    path.win32.join(windowsRoot, 'System32', 'wsl.exe'),
    path.win32.join(windowsRoot, 'Sysnative', 'wsl.exe'),
    'wsl.exe',
  ]

  for (const candidate of candidates) {
    if (candidate.endsWith('.exe') && fs.existsSync(candidate)) {
      return candidate
    }
  }

  return 'wsl.exe'
}

const WSL_EXECUTABLE_PATH = resolveWslExecutablePath()

const WSL_DISTRO_NAME_BLACKLIST = new Set(['docker-desktop', 'docker-desktop-data'])

function cleanWslDistroName(rawValue: string) {
  return rawValue.replace(/\u0000/g, '').replace(/\uFEFF/g, '').replace(/\s+\(default\)$/i, '').trim()
}

function isIgnoredWslDistro(name: string) {
  return WSL_DISTRO_NAME_BLACKLIST.has(name.toLowerCase())
}

function addWslDistroName(target: Set<string>, rawValue: string) {
  const normalized = cleanWslDistroName(rawValue)
  if (!normalized || isIgnoredWslDistro(normalized)) {
    return
  }
  target.add(normalized)
}

function parseWslVerboseDistroLine(line: string): { name: string; isDefault: boolean } | null {
  const withNoNulls = line.replace(/\u0000/g, '').replace(/\uFEFF/g, '').trim()
  if (!withNoNulls) {
    return null
  }

  const withoutMarker = withNoNulls.startsWith('*') ? withNoNulls.slice(1).trimStart() : withNoNulls
  const lower = withoutMarker.toLowerCase()
  if (lower.startsWith('name') || lower.startsWith('the windows subsystem for linux has no installed distributions')) {
    return null
  }

  const parts = withoutMarker.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean)
  if (!parts.length) {
    return null
  }

  return {
    name: parts[0],
    isDefault: withNoNulls.startsWith('*'),
  }
}

function trimTrailingPathSeparators(inputPath: string) {
  if (!inputPath) {
    return inputPath
  }

  if (process.platform === 'win32') {
    const normalized = inputPath.replace(/\//g, '\\')
    const root = path.win32.parse(normalized).root
    let next = normalized
    while (next.length > root.length && /[\\/]$/.test(next)) {
      next = next.slice(0, -1)
    }
    return next
  }

  const normalized = path.normalize(inputPath)
  const root = path.parse(normalized).root
  let next = normalized
  while (next.length > root.length && next.endsWith(path.sep)) {
    next = next.slice(0, -1)
  }
  return next
}

function parseWslProjectPath(projectPath: string): WslProjectLocation | null {
  if (process.platform !== 'win32') {
    return null
  }

  const normalized = path.win32.normalize(projectPath.trim())
  const match = normalized.match(WSL_UNC_PATH_PATTERN)
  if (!match) {
    return null
  }

  const distro = match[1]
  const relativePart = match[2]
  const segments = relativePart
    ? relativePart
        .split(/[\\/]+/)
        .map((segment) => segment.trim())
        .filter(Boolean)
    : []

  const linuxPath = segments.length ? `/${segments.join('/')}` : '/'
  const uncPath = `\\\\wsl.localhost\\${distro}${segments.length ? `\\${segments.join('\\')}` : ''}`

  return {
    distro,
    linuxPath,
    uncPath,
  }
}

function normalizeProjectPath(inputPath: string): string {
  const trimmed = inputPath.trim()
  if (!trimmed) {
    return ''
  }

  if (process.platform !== 'win32') {
    return trimTrailingPathSeparators(path.normalize(trimmed))
  }

  const wslLocation = parseWslProjectPath(trimmed)
  if (wslLocation) {
    return trimTrailingPathSeparators(wslLocation.uncPath)
  }

  return trimTrailingPathSeparators(path.win32.normalize(trimmed))
}

function getProjectPathKey(inputPath: string): string {
  const normalized = normalizeProjectPath(inputPath)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function resolveWslWorkingDirectory(location: WslProjectLocation, workingDirectory?: string): string {
  if (!workingDirectory?.trim()) {
    return location.linuxPath
  }

  const segments = workingDirectory
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (!segments.length) {
    return location.linuxPath
  }

  return path.posix.join(location.linuxPath, ...segments)
}

function buildWslBashCommand(command: string, workingDirectory: string): string {
  return `cd ${formatShellArg(workingDirectory)} && ${command}`
}

function getWslVscodeFolderUri(location: WslProjectLocation): string {
  const encodedPath = location.linuxPath.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `vscode-remote://wsl+${encodeURIComponent(location.distro)}${encodedPath}`
}

async function openWslProjectInTerminal(location: WslProjectLocation, terminalPreferenceId: string) {
  if (terminalPreferenceId === 'windows-terminal') {
    const result = await spawnDetached('wt', [WSL_EXECUTABLE_PATH, '-d', location.distro, '--cd', location.linuxPath])
    if (result.success) {
      return result
    }
  }

  return spawnDetached(WSL_EXECUTABLE_PATH, ['-d', location.distro, '--cd', location.linuxPath])
}

async function listWslDistros(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return []
  }

  const distros = new Set<string>()
  let defaultDistro: string | null = null

  try {
    const quietOutput = await runDockerCommandWith(WSL_EXECUTABLE_PATH, ['--list', '--quiet'])
    quietOutput
      .split(/\r?\n/)
      .forEach((line) => addWslDistroName(distros, line))
  } catch {
    // ignore and continue to fallback sources
  }

  try {
    const verboseOutput = await runDockerCommandWith(WSL_EXECUTABLE_PATH, ['--list', '--verbose'])
    verboseOutput.split(/\r?\n/).forEach((line) => {
      const parsed = parseWslVerboseDistroLine(line)
      if (!parsed) {
        return
      }

      addWslDistroName(distros, parsed.name)
      if (parsed.isDefault && !isIgnoredWslDistro(parsed.name)) {
        defaultDistro = cleanWslDistroName(parsed.name)
      }
    })
  } catch {
    // ignore and continue to fallback sources
  }

  for (const uncRoot of ['\\\\wsl.localhost\\', '\\\\wsl$\\']) {
    try {
      const uncEntries = await fs.promises.readdir(uncRoot)
      uncEntries.forEach((entry) => addWslDistroName(distros, entry))
    } catch {
      // ignore unavailable UNC roots
    }
  }

  try {
    const store = await getStore()
    for (const project of store.projects) {
      const parsed = parseWslProjectPath(project.path)
      if (parsed) {
        addWslDistroName(distros, parsed.distro)
      }
    }
  } catch {
    // ignore store read issues
  }

  const sorted = [...distros].sort((a, b) => a.localeCompare(b))
  if (!defaultDistro) {
    return sorted
  }

  const defaultIndex = sorted.findIndex((distro) => distro.toLowerCase() === defaultDistro?.toLowerCase())
  if (defaultIndex <= 0) {
    return sorted
  }

  const [defaultEntry] = sorted.splice(defaultIndex, 1)
  return [defaultEntry, ...sorted]
}

function runDockerCommandWith(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trimEnd())
        return
      }
      const message = stderr.trim() || `Docker command failed (exit ${code}).`
      reject(new Error(message))
    })
  })
}

function sanitizeShellMessage(message: string) {
  return message.replace(/\u0000/g, '').trim()
}

function isDockerDaemonError(message: string) {
  const normalized = sanitizeShellMessage(message).toLowerCase()
  return (
    normalized.includes('cannot connect to the docker daemon') ||
    normalized.includes('is the docker daemon running') ||
    normalized.includes('error during connect')
  )
}

function isDockerNotFoundError(message: string) {
  const normalized = sanitizeShellMessage(message).toLowerCase()
  return (
    normalized.includes('command not found') ||
    normalized.includes('not recognized as an internal or external command') ||
    normalized.includes('no such file or directory')
  )
}

function isRecoverableWslDockerError(message: string) {
  return isDockerNotFoundError(message) || isDockerDaemonError(message)
}

function formatShellArg(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildDockerShellCommand(args: string[]) {
  const parts = ['docker', ...args].map(formatShellArg)
  return parts.join(' ')
}

async function runWslDockerCommand(args: string[]) {
  const dockerCommand = buildDockerShellCommand(args)
  let defaultWslError: unknown

  try {
    return await runDockerCommandWith(WSL_EXECUTABLE_PATH, ['-e', 'bash', '-lc', dockerCommand])
  } catch (error) {
    defaultWslError = error
    const message = error instanceof Error ? error.message : 'Docker is not available in WSL.'
    if (!isRecoverableWslDockerError(message)) {
      throw error
    }
  }

  let distros: string[] = []
  try {
    const listOutput = await runDockerCommandWith(WSL_EXECUTABLE_PATH, ['-l', '-q'])
    distros = listOutput
      .replace(/\u0000/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    // If distro discovery fails, we'll surface the original WSL Docker error below.
  }

  for (const distro of distros) {
    try {
      return await runDockerCommandWith(WSL_EXECUTABLE_PATH, ['-d', distro, '-e', 'bash', '-lc', dockerCommand])
    } catch (distroError) {
      const distroMessage = distroError instanceof Error ? distroError.message : ''
      if (!isRecoverableWslDockerError(distroMessage)) {
        throw distroError
      }
      defaultWslError = distroError
    }
  }

  const fallbackMessage =
    defaultWslError instanceof Error
      ? defaultWslError.message
      : 'Docker not found in WSL. Install Docker in a WSL distro or enable Docker Desktop integration.'

  throw new Error(fallbackMessage)
}

async function runDockerCommand(args: string[]) {
  try {
    return await runDockerCommandWith('docker', args)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    const message = error instanceof Error ? error.message : 'Failed to run Docker command.'
    
    // On Windows, if docker.exe is missing (ENOENT), we can try WSL.
    // If it's a daemon error, we should probably just report it as a daemon error 
    // unless the user explicitly wants to use WSL. 
    // However, the current logic tries WSL for both.
    
    const isNotFound = err?.code === 'ENOENT'
    const isDaemonError = isDockerDaemonError(message)
    
    if (process.platform === 'win32') {
      if (isNotFound) {
        // CLI missing on Windows, try WSL
        try {
          return await runWslDockerCommand(args)
        } catch (wslError) {
          const wslErr = wslError as NodeJS.ErrnoException
          if (wslErr?.code === 'ENOENT') {
            throw new Error('Docker CLI not found. Install Docker Desktop or enable Docker in WSL.')
          }
          throw new Error(wslError instanceof Error ? wslError.message : 'Docker is not available in WSL.')
        }
      }
      
      if (isDaemonError) {
        // Daemon not running on Windows. 
        // We could try WSL here too, but the error message should be clearer if it fails.
        try {
          return await runWslDockerCommand(args)
        } catch (wslError) {
          // If WSL also fails or has no daemon, report the Windows daemon error as primary
          throw new Error(`Docker Desktop daemon is not running. (WSL fallback also failed: ${wslError instanceof Error ? wslError.message : 'Unknown error'})`)
        }
      }
    }

    if (isNotFound) {
      throw new Error('Docker CLI not found. Install Docker Desktop to enable containers.')
    }
    
    throw new Error(message)
  }
}

function parseDockerContainers(output: string): Container[] {
  if (!output.trim()) return []
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const entry = JSON.parse(line) as {
        ID?: string
        Names?: string
        Image?: string
        State?: string
        Status?: string
        Ports?: string
        CreatedAt?: string
        Labels?: string
        Command?: string
      }
      const rawState = `${entry.State ?? entry.Status ?? ''}`.toLowerCase()
      let state: Container['state'] = 'stopped'
      if (rawState.includes('running')) {
        state = 'running'
      } else if (rawState.includes('paused')) {
        state = 'paused'
      }

      const ports = entry.Ports
        ? entry.Ports.split(',')
            .map((port) => port.trim())
            .filter(Boolean)
        : []

      const labels = entry.Labels
        ? entry.Labels.split(',')
            .map((label) => label.trim())
            .filter(Boolean)
        : []

      const rawCommand = entry.Command?.trim()
      const command =
        rawCommand && rawCommand.startsWith('"') && rawCommand.endsWith('"')
          ? rawCommand.slice(1, -1)
          : rawCommand

      return {
        id: entry.ID ?? '',
        name: entry.Names ?? entry.ID ?? 'Unknown',
        image: entry.Image ?? 'Unknown',
        state,
        ports,
        status: entry.Status ?? entry.State ?? '',
        createdAt: entry.CreatedAt ?? '',
        labels,
        command: command ?? '',
      }
    })
}

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
  const normalizedPath = normalizeProjectPath(project.path)
  if (!fs.existsSync(normalizedPath)) {
    throw new Error('Project path does not exist.')
  }
  return normalizedPath
}

async function getProjectDirectories(projectId: string, relativePath?: string): Promise<string[]> {
  const projectPath = await getProjectPath(projectId)
  const targetPath = relativePath ? path.join(projectPath, relativePath) : projectPath

  if (!fs.existsSync(targetPath)) {
    return []
  }

  const entries = await fs.promises.readdir(targetPath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
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
  const wslLocation = parseWslProjectPath(projectPath)
  if (wslLocation) {
    const wslName = path.posix.basename(wslLocation.linuxPath)
    return wslName || wslLocation.distro
  }

  if (process.platform === 'win32') {
    return path.win32.basename(trimTrailingPathSeparators(projectPath))
  }

  return path.basename(trimTrailingPathSeparators(projectPath))
}

// Register all IPC handlers
export function registerIpcHandlers() {
  ipcMain.handle('wsl:list-distros', async () => {
    return listWslDistros()
  })

  ipcMain.handle('dialog:open-folder', async (_event, startPath?: string) => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Select Project Folder',
      properties: ['openDirectory'],
    }

    if (typeof startPath === 'string' && startPath.trim()) {
      options.defaultPath = normalizeProjectPath(startPath)
    }

    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }

    return { canceled: false, path: normalizeProjectPath(result.filePaths[0]) }
  })
  // Projects
  ipcMain.handle('projects:get', async () => {
    const store = await getStore()
    return store.projects
  })

  ipcMain.handle('projects:add', async (_event, inputPath: string) => {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Project path is required.')
    }

    const normalizedPath = normalizeProjectPath(inputPath)
    if (!normalizedPath) {
      throw new Error('Project path is required.')
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error('Project path does not exist.')
    }

    const store = await getStore()
    const normalizedPathKey = getProjectPathKey(normalizedPath)
    const existing = store.projects.find((project) => getProjectPathKey(project.path) === normalizedPathKey)
    if (existing) {
      return existing
    }

    const type = detectProjectType(normalizedPath)
    const nextProject = {
      id: randomUUID(),
      path: normalizedPath,
      name: getProjectName(normalizedPath),
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

  ipcMain.handle('projects:update', async (_event, _id: string, updates: { name?: string }) => {
    if (!_id) {
      throw new Error('Project id is required.')
    }

    const nextName = typeof updates?.name === 'string' ? updates.name.trim() : ''
    if (!nextName) {
      throw new Error('Project name is required.')
    }

    let updatedProject: Project | null = null
    await updateStore((draft) => {
      const index = draft.projects.findIndex((project) => project.id === _id)
      if (index === -1) {
        return
      }
      const current = draft.projects[index]
      updatedProject = { ...current, name: nextName }
      draft.projects[index] = updatedProject
    })

    if (!updatedProject) {
      throw new Error('Project not found.')
    }

    return updatedProject
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
    const wslLocation = parseWslProjectPath(projectPath)
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
      if (wslLocation && preference.id === 'vscode') {
        const remoteUri = getWslVscodeFolderUri(wslLocation)
        const openRemoteResult = await spawnDetached('code', ['--folder-uri', remoteUri])
        if (openRemoteResult.success) {
          return openRemoteResult
        }
        return spawnDetached('code', [projectPath])
      }
      const command = WINDOWS_EDITOR_COMMANDS[preference.id] ?? WINDOWS_EDITOR_COMMANDS.vscode
      return spawnDetached(command.command, command.args(projectPath))
    }
    return spawnDetached('code', [projectPath])
  })

  ipcMain.handle('projects:open-terminal', async (_event, _id: string) => {
    const projectPath = await getProjectPath(_id)
    const wslLocation = parseWslProjectPath(projectPath)
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
      if (wslLocation) {
        return openWslProjectInTerminal(wslLocation, preference.id)
      }
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
      command: { name: string; command: string; description?: string; tags?: string[]; projectId?: string; workingDirectory?: string }
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
        projectId: command.projectId,
        workingDirectory: command.workingDirectory,
      }

      await updateStore((draft) => {
        draft.commands.push(nextCommand)
      })

      return nextCommand
    }
  )

  ipcMain.handle('commands:update', async (_event, _id: string, updates: Partial<{
    name: string
    command: string
    description?: string
    tags?: string[]
    projectId?: string
    workingDirectory?: string
  }>) => {
    if (!_id) {
      throw new Error('Command id is required.')
    }

    const nextName = typeof updates?.name === 'string' ? updates.name.trim() : undefined
    const nextCommand = typeof updates?.command === 'string' ? updates.command.trim() : undefined
    if (nextName !== undefined && !nextName) {
      throw new Error('Command name is required.')
    }
    if (nextCommand !== undefined && !nextCommand) {
      throw new Error('Command is required.')
    }

    let updatedCommand: Command | null = null
    await updateStore((draft) => {
      const index = draft.commands.findIndex((entry) => entry.id === _id)
      if (index === -1) {
        return
      }
      const current = draft.commands[index]
      updatedCommand = {
        ...current,
        name: nextName ?? current.name,
        command: nextCommand ?? current.command,
        description: updates?.description ?? current.description,
        tags: Array.isArray(updates?.tags) ? updates.tags.filter(Boolean) : current.tags,
        projectId: updates?.projectId ?? current.projectId,
        workingDirectory: updates?.workingDirectory ?? current.workingDirectory,
      }
      draft.commands[index] = updatedCommand
    })

    if (!updatedCommand) {
      throw new Error('Command not found.')
    }

    return updatedCommand
  })

  ipcMain.handle('commands:remove', async (_event, _id: string) => {
    if (!_id) {
      return { success: false }
    }

    await updateStore((draft) => {
      draft.commands = draft.commands.filter((entry) => entry.id !== _id)
    })

    return { success: true }
  })

  ipcMain.handle('commands:get-directories', async (_event, projectId: string, relativePath?: string) => {
    return getProjectDirectories(projectId, relativePath)
  })

  ipcMain.handle('commands:run', async (_event, _id: string, _projectId?: string) => {
    const store = await getStore()
    const command = store.commands.find((entry) => entry.id === _id)
    if (!command) {
      throw new Error('Command not found.')
    }

    // Use command's projectId if not provided
    const effectiveProjectId = _projectId ?? command.projectId
    if (!effectiveProjectId) {
      throw new Error('Project is required to run a command.')
    }

    const project = store.projects.find((entry) => entry.id === effectiveProjectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const runId = randomUUID()
    const startTime = new Date().toISOString()

    await updateStore((draft) => {
      draft.runHistory.unshift({
        id: runId,
        commandId: command.id,
        projectId: project.id,
        status: 'running',
        startTime,
        output: '',
      })
    })

    const projectPath = normalizeProjectPath(project.path)
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project path does not exist.')
    }

    const wslLocation = parseWslProjectPath(projectPath)
    const child = wslLocation
      ? spawn(
          WSL_EXECUTABLE_PATH,
          [
            '-d',
            wslLocation.distro,
            '-e',
            'bash',
            '-lc',
            buildWslBashCommand(command.command, resolveWslWorkingDirectory(wslLocation, command.workingDirectory)),
          ],
          {
            env: process.env,
            windowsHide: true,
          }
        )
      : spawn(command.command, {
          cwd: command.workingDirectory ? path.join(projectPath, command.workingDirectory) : projectPath,
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
    const output = await runDockerCommand(['ps', '-a', '--no-trunc', '--format', '{{json .}}'])
    return parseDockerContainers(output)
  })

  ipcMain.handle('containers:start', async (_event, _id: string) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    await runDockerCommand(['start', _id])
    return { success: true }
  })

  ipcMain.handle('containers:stop', async (_event, _id: string) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    await runDockerCommand(['stop', _id])
    return { success: true }
  })

  ipcMain.handle('containers:restart', async (_event, _id: string) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    await runDockerCommand(['restart', _id])
    return { success: true }
  })

  ipcMain.handle('containers:pause', async (_event, _id: string) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    await runDockerCommand(['pause', _id])
    return { success: true }
  })

  ipcMain.handle('containers:unpause', async (_event, _id: string) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    await runDockerCommand(['unpause', _id])
    return { success: true }
  })

  ipcMain.handle('containers:remove', async (_event, _id: string, force?: boolean) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    const args = ['rm']
    if (force) {
      args.push('--force')
    }
    args.push(_id)
    await runDockerCommand(args)
    return { success: true }
  })

  ipcMain.handle('containers:logs', async (_event, _id: string) => {
    if (!_id) {
      throw new Error('Container id is required.')
    }
    const output = await runDockerCommand(['logs', '--tail', '200', _id])
    return output
  })

  // Run History
  ipcMain.handle('history:get', async () => {
    const store = await getStore()
    return store.runHistory
  })

  ipcMain.handle('history:clear', async () => {
    await updateStore((draft) => {
      draft.runHistory = []
    })
    return { success: true }
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
        setupSteps: '',
        todos: '',
        reminders: '',
      }
    )
  })

  ipcMain.handle('notes:update', async (_event, _projectId: string, _notes: unknown) => {
    if (!_projectId) {
      return { success: false }
    }

    const updates =
      typeof _notes === 'object' && _notes
        ? (_notes as Partial<{ setupSteps: string; todos: string; reminders: string }>)
        : {}

    await updateStore((draft) => {
      const current = draft.notes[_projectId] ?? {
        projectId: _projectId,
        setupSteps: '',
        todos: '',
        reminders: '',
      }
      draft.notes[_projectId] = {
        projectId: _projectId,
        setupSteps: updates.setupSteps ?? current.setupSteps,
        todos: updates.todos ?? current.todos,
        reminders: updates.reminders ?? current.reminders,
      }
    })

    return { success: true }
  })
}
