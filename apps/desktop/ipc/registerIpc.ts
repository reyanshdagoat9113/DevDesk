import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  clearRunHistoryInStore,
  createChain,
  getCommandById,
  getChainById,
  getPreferencesFromStore,
  getProjectById,
  getProjectNotesById,
  getRunHistoryOutputById,
  listChains,
  listCommands,
  listProjects,
  listRecentRunHistory,
  listRunHistory,
  createCommand,
  createProject,
  createRunHistoryEntry,
  finalizeRunHistoryEntry,
  removeCommand,
  removeChain,
  removeProject,
  renameProject,
  replaceChain,
  replaceCommand,
  updatePreferencesInStore,
  updateProjectLinkedContainers,
  upsertProjectNotes,
  toggleProjectPin,
  toggleCommandPin,
} from '../data/store'
import { detectProjectType, getProjectIcon } from '../projects/detectProjectType'
import type {
  AppPreference,
  AppPreferences,
  ChainStep,
  Command,
  CommandChain,
  Container,
  Project,
  RunStatus,
} from '../data/model'
import { listProjectFiles, searchProjectFiles, openFileInEditor, clearFileIndex } from '../files/fileService'
import { variableResolver } from '../commands/variableResolver'
import { detectVariables } from '../commands/variableDetector'

type RunningCommand = {
  process: ChildProcessWithoutNullStreams
  output: string
  requestedStop: boolean
  completion: Promise<RunStatus>
}

const runningCommands = new Map<string, RunningCommand>()

type ChainStepRunPayload = {
  stepId: string
  commandId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'stopped' | 'skipped'
  runId?: string
  startedAt?: string
  endedAt?: string
  error?: string
}

type ChainRunPayload = {
  runId: string
  chainId: string
  projectId?: string
  status: 'running' | 'success' | 'failed' | 'stopped'
  startedAt: string
  endedAt?: string
  activeStepId?: string
  error?: string
  steps: ChainStepRunPayload[]
}

const runningChains = new Map<string, ChainRunPayload>()

type RunningDockerLogSubscription = {
  process: ChildProcessWithoutNullStreams
  containerId: string
}

const runningDockerLogSubscriptions = new Map<string, RunningDockerLogSubscription>()

type WslProjectLocation = {
  distro: string
  linuxPath: string
  uncPath: string
}

type SpawnDetachedOptions = {
  shell?: boolean
  windowsHide?: boolean
}

type DetachedLaunchCommand = {
  command: string
  args: string[]
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

function formatPowerShellLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function formatCmdLiteral(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function getWslTerminalLaunchCandidates(location: WslProjectLocation, terminalPreferenceId: string): DetachedLaunchCommand[] {
  const windowsTerminalLaunches: DetachedLaunchCommand[] = [
    { command: 'wt', args: [WSL_EXECUTABLE_PATH, '-d', location.distro, '--cd', location.linuxPath] },
    { command: 'wt', args: ['-d', location.uncPath] },
  ]

  const powershellLaunch: DetachedLaunchCommand = {
    command: 'powershell',
    args: [
      '-NoExit',
      '-Command',
      `& ${formatPowerShellLiteral(WSL_EXECUTABLE_PATH)} -d ${formatPowerShellLiteral(location.distro)} --cd ${formatPowerShellLiteral(location.linuxPath)}`,
    ],
  }

  const cmdLaunch: DetachedLaunchCommand = {
    command: 'cmd.exe',
    args: ['/k', `${formatCmdLiteral(WSL_EXECUTABLE_PATH)} -d ${formatCmdLiteral(location.distro)} --cd ${formatCmdLiteral(location.linuxPath)}`],
  }

  if (terminalPreferenceId === 'powershell') {
    return [powershellLaunch, cmdLaunch, ...windowsTerminalLaunches]
  }

  if (terminalPreferenceId === 'cmd') {
    return [cmdLaunch, powershellLaunch, ...windowsTerminalLaunches]
  }

  return [...windowsTerminalLaunches, powershellLaunch, cmdLaunch]
}

async function openWslProjectInTerminal(location: WslProjectLocation, terminalPreferenceId: string) {
  const launchCandidates = getWslTerminalLaunchCandidates(location, terminalPreferenceId)
  let lastError = 'Failed to open WSL project in terminal.'

  for (const launch of launchCandidates) {
    const result = await spawnDetachedWithShellFallback(launch.command, launch.args, { windowsHide: false })
    if (result.success) {
      return result
    }

    if (result.error) {
      lastError = result.error
    }
  }

  return { success: false, error: lastError }
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
    const projects = await listProjects()
    for (const project of projects) {
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
    normalized.includes('failed to connect to the docker api') ||
    normalized.includes('cannot connect to the docker daemon') ||
    normalized.includes('is the docker daemon running') ||
    normalized.includes('error during connect') ||
    normalized.includes('dial unix') ||
    normalized.includes('docker.sock')
  )
}

function isDockerNotFoundError(message: string) {
  const normalized = sanitizeShellMessage(message).toLowerCase()
  return (
    normalized.includes('command not found') ||
    normalized.includes('not recognized as an internal or external command')
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

    if (isDaemonError) {
      throw new Error('Docker daemon is not running. Start Docker Desktop and try again.')
    }
    
    throw new Error(message)
  }
}

function parseDockerContainers(output: string): Container[] {
  if (!output.trim()) {
    return []
  }

  const containers: Container[] = []
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    try {
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

      containers.push({
        id: entry.ID ?? '',
        name: entry.Names ?? entry.ID ?? 'Unknown',
        image: entry.Image ?? 'Unknown',
        state,
        ports,
        status: entry.Status ?? entry.State ?? '',
        createdAt: entry.CreatedAt ?? '',
        labels,
        command: command ?? '',
      })
    } catch {
      continue
    }
  }

  return containers
}

function sanitizeLinkedContainerNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const next: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') {
      continue
    }
    const trimmed = raw.trim()
    if (!trimmed) {
      continue
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push(trimmed)
  }

  return next
}

async function listDockerContainers(): Promise<Container[]> {
  const output = await runDockerCommand(['ps', '-a', '--no-trunc', '--format', '{{json .}}'])
  return parseDockerContainers(output)
}

function requireContainerId(input: string) {
  const containerId = input.trim()
  if (!containerId) {
    throw new Error('Container id is required.')
  }
  return containerId
}

function getContainerByLinkedName(containers: Container[], linkedName: string): Container | null {
  const key = linkedName.trim().toLowerCase()
  if (!key) {
    return null
  }
  return containers.find((container) => container.name.trim().toLowerCase() === key) ?? null
}

function getWslDockerLaunchArgs(args: string[]) {
  return ['-e', 'bash', '-lc', buildDockerShellCommand(args)]
}

function getWslDistroDockerLaunchArgs(distro: string, args: string[]) {
  return ['-d', distro, ...getWslDockerLaunchArgs(args)]
}

async function resolveDockerStreamLaunch(args: string[]): Promise<{ command: string; args: string[] }> {
  if (process.platform !== 'win32') {
    return { command: 'docker', args }
  }

  try {
    await runDockerCommandWith('docker', ['version', '--format', '{{.Server.Version}}'])
    return { command: 'docker', args }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Docker not available.'
    if (!isRecoverableWslDockerError(message)) {
      throw error
    }
  }

  try {
    await runDockerCommandWith(WSL_EXECUTABLE_PATH, getWslDockerLaunchArgs(['version', '--format', '{{.Server.Version}}']))
    return {
      command: WSL_EXECUTABLE_PATH,
      args: getWslDockerLaunchArgs(args),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Docker not available in WSL.'
    if (!isRecoverableWslDockerError(message)) {
      throw error
    }
  }

  const distros = await listWslDistros()
  for (const distro of distros) {
    try {
      await runDockerCommandWith(
        WSL_EXECUTABLE_PATH,
        getWslDistroDockerLaunchArgs(distro, ['version', '--format', '{{.Server.Version}}'])
      )
      return {
        command: WSL_EXECUTABLE_PATH,
        args: getWslDistroDockerLaunchArgs(distro, args),
      }
    } catch {
      // Try next distro
    }
  }

  throw new Error('Docker is not available. Install Docker Desktop or enable Docker inside WSL.')
}

async function spawnDockerCommandStream(args: string[]): Promise<ChildProcessWithoutNullStreams> {
  const launch = await resolveDockerStreamLaunch(args)
  return spawn(launch.command, launch.args, {
    windowsHide: true,
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
  ghostty: 'Ghostty',
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
  const project = await getProjectById(projectId)
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
  return getPreferencesFromStore()
}

function spawnDetached(command: string, args: string[], options: SpawnDetachedOptions = {}) {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const shell = options.shell ?? false
    const windowsHide = options.windowsHide ?? true
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide,
        shell,
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

function shouldRetryDetachedWithShell(error?: string) {
  if (!error) {
    return false
  }

  const normalized = error.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('not recognized as an internal or external command')
}

async function spawnDetachedWithShellFallback(command: string, args: string[], options: SpawnDetachedOptions = {}) {
  const result = await spawnDetached(command, args, options)
  if (result.success || process.platform !== 'win32' || options.shell || !shouldRetryDetachedWithShell(result.error)) {
    return result
  }

  return spawnDetached(command, args, { ...options, shell: true })
}

function spawnShellDetached(command: string, options: SpawnDetachedOptions = {}) {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const windowsHide = options.windowsHide ?? true
    try {
      const child = spawn(command, {
        detached: true,
        stdio: 'ignore',
        windowsHide,
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

function resolveCustomCommand(preference: AppPreference, projectPath: string, options: SpawnDetachedOptions = {}) {
  if (!preference.command) {
    return { success: false, error: 'Custom command is required.' }
  }
  const command = preference.command.includes('{path}')
    ? preference.command.split('{path}').join(`"${projectPath}"`)
    : `${preference.command} "${projectPath}"`
  return spawnShellDetached(command, options)
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

type ChainMutationInput = {
  name: string
  description?: string
  projectId?: string
  steps: Array<{ id: string; commandId: string; variables?: Record<string, string>; delayMs?: number }>
  stopOnFailure: boolean
  parallel?: boolean
}

type CommandNeedsInputResponse = {
  status: 'needs-input'
  inputs: Array<{ name: string; default?: string; required: boolean; description?: string }>
  preview: string
}

type PreparedCommandExecution = {
  command: Command
  project: Project
  projectPath: string
  finalCommand: string
}

type StartedCommandRun = {
  runId: string
  status: 'running'
  completion: Promise<RunStatus>
}

function sanitizeStepVariables(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) => [key.trim(), typeof entryValue === 'string' ? entryValue : String(entryValue ?? '')] as const)
    .filter(([key, entryValue]) => Boolean(key) && Boolean(entryValue.trim()))

  if (!entries.length) {
    return undefined
  }

  return Object.fromEntries(entries)
}

function sanitizeChainSteps(steps: unknown): ChainStep[] {
  if (!Array.isArray(steps)) {
    throw new Error('Chain steps are required.')
  }

  const sanitized = steps.reduce<ChainStep[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Step ${index + 1} is invalid.`)
    }

    const raw = entry as Partial<ChainStep>
    const stepId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : randomUUID()
    const commandId = typeof raw.commandId === 'string' ? raw.commandId.trim() : ''
    if (!commandId) {
      throw new Error(`Step ${index + 1} must reference a command.`)
    }

    const delayMs =
      typeof raw.delayMs === 'number' && Number.isFinite(raw.delayMs) && raw.delayMs > 0
        ? Math.max(0, Math.floor(raw.delayMs))
        : undefined

    acc.push({
      id: stepId,
      commandId,
      variables: sanitizeStepVariables(raw.variables),
      delayMs,
    })
    return acc
  }, [])

  if (!sanitized.length) {
    throw new Error('Add at least one step to the chain.')
  }

  return sanitized
}

function sanitizeChainInput(input: ChainMutationInput): Omit<CommandChain, 'id' | 'createdAt' | 'updatedAt'> {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name) {
    throw new Error('Chain name is required.')
  }

  return {
    name,
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    projectId: typeof input.projectId === 'string' && input.projectId.trim() ? input.projectId.trim() : undefined,
    steps: sanitizeChainSteps(input.steps),
    stopOnFailure: input.stopOnFailure !== false,
    parallel: Boolean(input.parallel),
  }
}

async function prepareCommandExecution(
  command: Command,
  preferredProjectId?: string,
  variables?: Record<string, string>
): Promise<PreparedCommandExecution | CommandNeedsInputResponse> {
  const effectiveProjectId = preferredProjectId ?? command.projectId
  if (!effectiveProjectId) {
    throw new Error('Project is required to run a command.')
  }

  const project = await getProjectById(effectiveProjectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const projectPath = normalizeProjectPath(project.path)
  if (!fs.existsSync(projectPath)) {
    throw new Error('Project path does not exist.')
  }

  const hasContainerVariables = variableResolver
    .extractVariables(command.command)
    .some((variable) => variable.startsWith('container.'))

  let linkedContainers: Container[] = []
  if (hasContainerVariables) {
    const containers = await listDockerContainers()
    linkedContainers = containers.filter((container) =>
      project.linkedContainerNames.some((name) => container.name.toLowerCase() === name.toLowerCase())
    )
  }

  const resolution = variableResolver.resolve(
    command.command,
    {
      project,
      containers: linkedContainers,
      env: process.env,
    },
    variables
  )

  if (resolution.unresolvedInputs.length > 0 && !variables) {
    return {
      status: 'needs-input',
      inputs: resolution.unresolvedInputs,
      preview: resolution.resolvedCommand,
    }
  }

  return {
    command,
    project,
    projectPath,
    finalCommand: resolution.resolvedCommand,
  }
}

async function startPreparedCommandExecution(prepared: PreparedCommandExecution): Promise<StartedCommandRun> {
  const runId = randomUUID()
  const startTime = new Date().toISOString()

  await createRunHistoryEntry({
    id: runId,
    commandId: prepared.command.id,
    projectId: prepared.project.id,
    status: 'running',
    startTime,
    output: '',
    resolvedCommand: prepared.finalCommand,
  })

  const wslLocation = parseWslProjectPath(prepared.projectPath)
  const child = wslLocation
    ? spawn(
        WSL_EXECUTABLE_PATH,
        [
          '-d',
          wslLocation.distro,
          '-e',
          'bash',
          '-lc',
          buildWslBashCommand(
            prepared.finalCommand,
            resolveWslWorkingDirectory(wslLocation, prepared.command.workingDirectory)
          ),
        ],
        {
          env: process.env,
          windowsHide: true,
        }
      )
    : spawn(prepared.finalCommand, {
        cwd: prepared.command.workingDirectory
          ? path.join(prepared.projectPath, prepared.command.workingDirectory)
          : prepared.projectPath,
        shell: true,
        env: process.env,
      })

  let resolveCompletion: ((status: RunStatus) => void) | null = null
  const completion = new Promise<RunStatus>((resolve) => {
    resolveCompletion = resolve
  })

  const running: RunningCommand = {
    process: child,
    output: '',
    requestedStop: false,
    completion,
  }
  runningCommands.set(runId, running)

  const flushOutput = async (runStatus?: RunStatus) => {
    await finalizeRunHistoryEntry(runId, running.output, runStatus)
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
    resolveCompletion?.('failed')
  })

  child.on('close', async (code) => {
    const status: RunStatus = running.requestedStop ? 'stopped' : code === 0 ? 'success' : 'failed'
    await flushOutput(status)
    runningCommands.delete(runId)
    broadcast('runs:status', { runId, status })
    resolveCompletion?.(status)
  })

  return {
    runId,
    status: 'running',
    completion,
  }
}

async function startCommandExecution(
  command: Command,
  preferredProjectId?: string,
  variables?: Record<string, string>
): Promise<StartedCommandRun | CommandNeedsInputResponse> {
  const prepared = await prepareCommandExecution(command, preferredProjectId, variables)
  if ('status' in prepared) {
    return prepared
  }
  return startPreparedCommandExecution(prepared)
}

function cloneChainRunPayload(payload: ChainRunPayload): ChainRunPayload {
  return {
    ...payload,
    steps: payload.steps.map((step) => ({ ...step })),
  }
}

function emitChainProgress(payload: ChainRunPayload) {
  const snapshot = cloneChainRunPayload(payload)
  runningChains.set(snapshot.runId, snapshot)
  broadcast('chains:progress', snapshot)
  if (snapshot.status !== 'running') {
    runningChains.delete(snapshot.runId)
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
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
    return listProjects()
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

    const projects = await listProjects()
    const normalizedPathKey = getProjectPathKey(normalizedPath)
    const existing = projects.find((project) => getProjectPathKey(project.path) === normalizedPathKey)
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
      linkedContainerNames: [],
    }

    await createProject(nextProject)

    return nextProject
  })

  ipcMain.handle('projects:remove', async (_event, _id: string) => {
    if (!_id) {
      return { success: false }
    }

    await removeProject(_id)

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

    const updated = await renameProject(_id, nextName)
    if (!updated) {
      throw new Error('Project not found.')
    }

    const updatedProject = await getProjectById(_id)
    if (!updatedProject) {
      throw new Error('Project not found.')
    }
    return updatedProject
  })

  ipcMain.handle('projects:set-linked-containers', async (_event, projectId: string, linkedContainerNames: unknown) => {
    if (!projectId?.trim()) {
      throw new Error('Project id is required.')
    }

    const sanitized = sanitizeLinkedContainerNames(linkedContainerNames)

    const updated = await updateProjectLinkedContainers(projectId, sanitized)
    if (!updated) {
      throw new Error('Project not found.')
    }

    const updatedProject = await getProjectById(projectId)
    if (!updatedProject) {
      throw new Error('Project not found.')
    }
    return updatedProject
  })

  ipcMain.handle('projects:start-dev-stack', async (_event, projectId: string) => {
    if (!projectId?.trim()) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const linkedNames = sanitizeLinkedContainerNames(project.linkedContainerNames)
    if (!linkedNames.length) {
      return { success: true, started: [], resumed: [], alreadyRunning: [], missing: [] }
    }

    const containers = await listDockerContainers()
    const started: string[] = []
    const resumed: string[] = []
    const alreadyRunning: string[] = []
    const missing: string[] = []

    for (const linkedName of linkedNames) {
      const container = getContainerByLinkedName(containers, linkedName)
      if (!container) {
        missing.push(linkedName)
        continue
      }

      if (container.state === 'running') {
        alreadyRunning.push(container.name)
        continue
      }

      if (container.state === 'paused') {
        await runDockerCommand(['unpause', container.id])
        resumed.push(container.name)
        continue
      }

      await runDockerCommand(['start', container.id])
      started.push(container.name)
    }

    return { success: true, started, resumed, alreadyRunning, missing }
  })

  ipcMain.handle('projects:stop-dev-stack', async (_event, projectId: string) => {
    if (!projectId?.trim()) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    const linkedNames = sanitizeLinkedContainerNames(project.linkedContainerNames)
    if (!linkedNames.length) {
      return { success: true, stopped: [], alreadyStopped: [], missing: [] }
    }

    const containers = await listDockerContainers()
    const stopped: string[] = []
    const alreadyStopped: string[] = []
    const missing: string[] = []

    for (const linkedName of linkedNames) {
      const container = getContainerByLinkedName(containers, linkedName)
      if (!container) {
        missing.push(linkedName)
        continue
      }

      if (container.state === 'stopped') {
        alreadyStopped.push(container.name)
        continue
      }

      if (container.state === 'paused') {
        await runDockerCommand(['unpause', container.id])
      }

      await runDockerCommand(['stop', container.id])
      stopped.push(container.name)
    }

    return { success: true, stopped, alreadyStopped, missing }
  })

  ipcMain.handle('projects:toggle-pin', async (_event, projectId: string) => {
    if (!projectId?.trim()) {
      throw new Error('Project id is required.')
    }

    const project = await toggleProjectPin(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    return project
  })

  ipcMain.handle('preferences:get', async () => {
    return getPreferences()
  })

  ipcMain.handle('preferences:update', async (_event, updates: Partial<AppPreferences>) => {
    await updatePreferencesInStore(updates)
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
        const openRemoteResult = await spawnDetachedWithShellFallback('code', ['--folder-uri', remoteUri])
        if (openRemoteResult.success) {
          return openRemoteResult
        }
        return spawnDetachedWithShellFallback('code', [projectPath])
      }
      const command = WINDOWS_EDITOR_COMMANDS[preference.id] ?? WINDOWS_EDITOR_COMMANDS.vscode
      return spawnDetachedWithShellFallback(command.command, command.args(projectPath))
    }
    return spawnDetached('code', [projectPath])
  })

  ipcMain.handle('projects:open-terminal', async (_event, _id: string) => {
    const projectPath = await getProjectPath(_id)
    const wslLocation = parseWslProjectPath(projectPath)
    const preferences = await getPreferences()
    const preference = preferences.terminal
    if (preference.id === 'custom') {
      return resolveCustomCommand(preference, projectPath, { windowsHide: false })
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
      return spawnDetachedWithShellFallback(command.command, command.args(projectPath), { windowsHide: false })
    }
    return spawnDetached('x-terminal-emulator', ['--working-directory', projectPath])
  })

  // Commands
  ipcMain.handle('commands:get', async () => {
    return listCommands()
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

      await createCommand(nextCommand)

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

    const current = await getCommandById(_id)
    if (!current) {
      throw new Error('Command not found.')
    }

    const updatedCommand: Command = {
      ...current,
      name: nextName ?? current.name,
      command: nextCommand ?? current.command,
      description: updates?.description ?? current.description,
      tags: Array.isArray(updates?.tags) ? updates.tags.filter(Boolean) : current.tags,
      projectId: updates?.projectId ?? current.projectId,
      workingDirectory: updates?.workingDirectory ?? current.workingDirectory,
    }

    await replaceCommand(updatedCommand)
    return updatedCommand
  })

  ipcMain.handle('commands:remove', async (_event, _id: string) => {
    if (!_id) {
      return { success: false }
    }

    await removeCommand(_id)

    return { success: true }
  })

  ipcMain.handle('commands:get-directories', async (_event, projectId: string, relativePath?: string) => {
    return getProjectDirectories(projectId, relativePath)
  })

  ipcMain.handle('commands:run', async (_event, _id: string, _projectId?: string, _variables?: Record<string, string>) => {
    const command = await getCommandById(_id)
    if (!command) {
      throw new Error('Command not found.')
    }

    const run = await startCommandExecution(command, _projectId, _variables)
    if ('status' in run && run.status === 'needs-input') {
      return run
    }
    return { runId: run.runId, status: run.status }
  })

  ipcMain.handle('commands:detect-variables', async (_event, commandString: string) => {
    return detectVariables(commandString)
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

  ipcMain.handle('commands:toggle-pin', async (_event, commandId: string) => {
    if (!commandId?.trim()) {
      throw new Error('Command id is required.')
    }

    const command = await toggleCommandPin(commandId)
    if (!command) {
      throw new Error('Command not found.')
    }

    return command
  })

  ipcMain.handle('chains:list', async () => {
    return listChains()
  })

  ipcMain.handle('chains:create', async (_event, input: ChainMutationInput) => {
    const sanitized = sanitizeChainInput(input)
    const now = new Date().toISOString()
    const nextChain: CommandChain = {
      id: randomUUID(),
      ...sanitized,
      createdAt: now,
      updatedAt: now,
    }

    await createChain(nextChain)
    return nextChain
  })

  ipcMain.handle('chains:update', async (_event, chainId: string, input: ChainMutationInput) => {
    if (!chainId?.trim()) {
      throw new Error('Chain id is required.')
    }

    const current = await getChainById(chainId)
    if (!current) {
      throw new Error('Chain not found.')
    }

    const sanitized = sanitizeChainInput(input)
    const updatedChain: CommandChain = {
      ...current,
      ...sanitized,
      updatedAt: new Date().toISOString(),
    }

    await replaceChain(updatedChain)
    return updatedChain
  })

  ipcMain.handle('chains:delete', async (_event, chainId: string) => {
    if (!chainId?.trim()) {
      return { success: false }
    }

    await removeChain(chainId)
    return { success: true }
  })

  ipcMain.handle('chains:run', async (_event, chainId: string, projectId?: string) => {
    if (!chainId?.trim()) {
      throw new Error('Chain id is required.')
    }

    const chain = await getChainById(chainId)
    if (!chain) {
      throw new Error('Chain not found.')
    }

    if (!chain.steps.length) {
      throw new Error('Add at least one step before running this chain.')
    }

    const effectiveProjectId = projectId?.trim() || chain.projectId
    const runId = randomUUID()
    const payload: ChainRunPayload = {
      runId,
      chainId: chain.id,
      projectId: effectiveProjectId,
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: chain.steps.map((step) => ({
        stepId: step.id,
        commandId: step.commandId,
        status: 'pending',
      })),
    }

    emitChainProgress(payload)

    void (async () => {
      let finalStatus: ChainRunPayload['status'] = 'success'
      let finalError: string | undefined

      for (let index = 0; index < chain.steps.length; index += 1) {
        const step = chain.steps[index]
        const stepPayload = payload.steps[index]

        if (step.delayMs && step.delayMs > 0) {
          await delay(step.delayMs)
        }

        payload.activeStepId = step.id
        stepPayload.status = 'running'
        stepPayload.startedAt = new Date().toISOString()
        emitChainProgress(payload)

        const command = await getCommandById(step.commandId)
        if (!command) {
          stepPayload.status = 'failed'
          stepPayload.endedAt = new Date().toISOString()
          stepPayload.error = 'Referenced command no longer exists.'
          finalStatus = 'failed'
          finalError = stepPayload.error
          emitChainProgress(payload)
          break
        }

        try {
          const run = await startCommandExecution(command, command.projectId ?? effectiveProjectId, step.variables)

          if ('status' in run && run.status === 'needs-input') {
            stepPayload.status = 'failed'
            stepPayload.endedAt = new Date().toISOString()
            stepPayload.error = `Missing chain step variables: ${run.inputs.map((input) => input.name).join(', ')}`
            finalStatus = 'failed'
            finalError = stepPayload.error
            emitChainProgress(payload)
            break
          }

          stepPayload.runId = run.runId
          emitChainProgress(payload)

          const runStatus = await run.completion
          stepPayload.status = runStatus
          stepPayload.endedAt = new Date().toISOString()
          emitChainProgress(payload)

          if (runStatus === 'stopped') {
            finalStatus = 'stopped'
            break
          }

          if (runStatus !== 'success') {
            finalStatus = 'failed'
            finalError = `Step ${index + 1} failed.`
            if (chain.stopOnFailure) {
              break
            }
          }
        } catch (error) {
          stepPayload.status = 'failed'
          stepPayload.endedAt = new Date().toISOString()
          stepPayload.error = error instanceof Error ? error.message : 'Step failed to start.'
          finalStatus = 'failed'
          finalError = stepPayload.error
          emitChainProgress(payload)
          if (chain.stopOnFailure) {
            break
          }
        }
      }

      for (const step of payload.steps) {
        if (step.status === 'pending') {
          step.status = finalStatus === 'success' ? 'success' : 'skipped'
        }
      }

      payload.status = finalStatus
      payload.error = finalError
      payload.activeStepId = undefined
      payload.endedAt = new Date().toISOString()
      emitChainProgress(payload)
    })()

    return { runId, status: 'running' }
  })

  // Containers
  ipcMain.handle('containers:get', async () => {
    return listDockerContainers()
  })

  ipcMain.handle('containers:start', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['start', containerId])
    return { success: true }
  })

  ipcMain.handle('containers:stop', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['stop', containerId])
    return { success: true }
  })

  ipcMain.handle('containers:restart', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['restart', containerId])
    return { success: true }
  })

  ipcMain.handle('containers:pause', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['pause', containerId])
    return { success: true }
  })

  ipcMain.handle('containers:unpause', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['unpause', containerId])
    return { success: true }
  })

  ipcMain.handle('containers:remove', async (_event, _id: string, force?: boolean) => {
    const containerId = requireContainerId(_id)
    const args = ['rm']
    if (force) {
      args.push('--force')
    }
    args.push(containerId)
    await runDockerCommand(args)
    return { success: true }
  })

  ipcMain.handle('containers:logs', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    const output = await runDockerCommand(['logs', '--tail', '200', containerId])
    return output
  })

  ipcMain.handle('docker:list', async () => {
    return listDockerContainers()
  })

  ipcMain.handle('docker:start', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['start', containerId])
    return { success: true }
  })

  ipcMain.handle('docker:stop', async (_event, _id: string) => {
    const containerId = requireContainerId(_id)
    await runDockerCommand(['stop', containerId])
    return { success: true }
  })

  ipcMain.handle('docker:logs:subscribe', async (_event, _id: string, tail?: number) => {
    const containerId = requireContainerId(_id)
    const subscriptionId = randomUUID()
    const tailCount = Number.isFinite(tail) ? Math.max(1, Math.min(2000, Math.floor(tail as number))) : 200
    const stream = await spawnDockerCommandStream(['logs', '--follow', '--tail', String(tailCount), containerId])

    runningDockerLogSubscriptions.set(subscriptionId, {
      process: stream,
      containerId,
    })

    const pushChunk = (chunk: Buffer) => {
      broadcast('docker:logs:data', {
        subscriptionId,
        containerId,
        chunk: chunk.toString(),
      })
    }

    stream.stdout.on('data', pushChunk)
    stream.stderr.on('data', pushChunk)

    stream.on('error', (error) => {
      runningDockerLogSubscriptions.delete(subscriptionId)
      broadcast('docker:logs:error', {
        subscriptionId,
        containerId,
        error: error.message,
      })
    })

    stream.on('close', (code) => {
      runningDockerLogSubscriptions.delete(subscriptionId)
      broadcast('docker:logs:end', {
        subscriptionId,
        containerId,
        code,
      })
    })

    return { subscriptionId }
  })

  ipcMain.handle('docker:logs:unsubscribe', async (_event, subscriptionId: string) => {
    const id = subscriptionId?.trim()
    if (!id) {
      return { success: false }
    }

    const running = runningDockerLogSubscriptions.get(id)
    if (!running) {
      return { success: false }
    }

    running.process.kill()
    runningDockerLogSubscriptions.delete(id)
    return { success: true }
  })

  // Run History
  ipcMain.handle('history:get', async () => {
    return listRunHistory()
  })

  ipcMain.handle('history:listRecent', async (_event, limit?: number) => {
    const cap = Math.min(Math.max(1, limit ?? 20), 100)
    return listRecentRunHistory(cap)
  })

  ipcMain.handle('history:clear', async () => {
    await clearRunHistoryInStore()
    return { success: true }
  })

  ipcMain.handle('history:output', async (_event, _runId: string) => {
    const running = runningCommands.get(_runId)
    if (running) {
      return running.output
    }
    return getRunHistoryOutputById(_runId)
  })

  // Notes
  ipcMain.handle('notes:get', async (_event, _projectId: string) => {
    return getProjectNotesById(_projectId)
  })

  ipcMain.handle('notes:update', async (_event, _projectId: string, _notes: unknown) => {
    if (!_projectId) {
      return { success: false }
    }

    const updates =
      typeof _notes === 'object' && _notes
        ? (_notes as Partial<{ setupSteps: string; todos: string; reminders: string }>)
        : {}

    await upsertProjectNotes(_projectId, updates)

    return { success: true }
  })

  // File navigation
  ipcMain.handle('files:list', async (_event, projectId: string, dir?: string) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    return listProjectFiles(project.path, dir)
  })

  ipcMain.handle('files:search', async (_event, projectId: string, query: string, limit?: number) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }

    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error('Project not found.')
    }

    return searchProjectFiles(projectId, project.path, query, limit)
  })

  ipcMain.handle('files:openInEditor', async (
    _event,
    projectId: string,
    relativePath: string,
    line?: number,
    column?: number
  ) => {
    if (!projectId) {
      throw new Error('Project id is required.')
    }
    if (!relativePath) {
      throw new Error('File path is required.')
    }

    const [project, preferences] = await Promise.all([
      getProjectById(projectId),
      getPreferencesFromStore(),
    ])
    if (!project) {
      throw new Error('Project not found.')
    }

    return openFileInEditor(project.path, relativePath, preferences, line, column)
  })

  ipcMain.handle('files:clearIndex', async (_event, projectId: string) => {
    clearFileIndex(projectId)
    return { success: true }
  })
}
