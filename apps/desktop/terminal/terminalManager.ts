import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { getPreferencesFromStore, getProjectById } from '../data/store'
import type { TerminalCreateOptions, TerminalSession } from '../data/model'

type BroadcastFn = (channel: string, payload: unknown) => void

function getCleanEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

const WSL_UNC_PATH_PATTERN = /^\\\\wsl(?:\.localhost|\$)\\([^\\/]+)(?:[\\/](.*))?$/i

function parseWslProjectPath(projectPath: string): { distro: string; linuxPath: string; uncPath: string } | null {
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

  return { distro, linuxPath, uncPath }
}

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe'
  }
  return process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

const ALLOWED_SHELLS = new Set([
  'powershell.exe',
  'cmd.exe',
  'pwsh.exe',
  '/bin/zsh',
  '/bin/bash',
  '/bin/fish',
  '/bin/sh',
])

const BLOCKED_PATHS = [
  'windows',
  'system32',
  'syswow64',
  'winsxs',
]

function validateShell(shell: string): string {
  const normalized = shell.trim()
  const basename = path.basename(normalized).toLowerCase()

  if (!ALLOWED_SHELLS.has(basename) && !ALLOWED_SHELLS.has(normalized)) {
    throw new Error(`Shell not allowed: ${shell}`)
  }

  return normalized
}

function isBlockedSystemPath(dirPath: string): boolean {
  const normalized = dirPath.toLowerCase().replace(/[\\/]/g, '\\')
  return BLOCKED_PATHS.some((blocked) => normalized.includes(`\\${blocked}\\`) || normalized.endsWith(`\\${blocked}`))
}

async function resolveShell(options: TerminalCreateOptions): Promise<string> {
  if (options.shell) {
    return validateShell(options.shell)
  }

  const preferences = await getPreferencesFromStore()
  const terminalPref = preferences.terminal?.id

  if (process.platform === 'win32') {
    if (terminalPref === 'powershell') return 'powershell.exe'
    if (terminalPref === 'cmd') return 'cmd.exe'
    if (terminalPref === 'windows-terminal') return 'powershell.exe'
    return 'powershell.exe'
  }

  if (terminalPref === 'terminal') return '/bin/zsh'
  if (terminalPref === 'iterm') return '/bin/zsh'

  return getDefaultShell()
}

function resolveWorkingDirectory(options: TerminalCreateOptions): { cwd: string; isWsl: boolean } {
  if (options.cwd) {
    const wslLocation = parseWslProjectPath(options.cwd)
    if (wslLocation) {
      return { cwd: wslLocation.linuxPath, isWsl: true }
    }
    const resolved = path.resolve(options.cwd)
    if (isBlockedSystemPath(resolved)) {
      throw new Error(`Working directory is not allowed: ${options.cwd}`)
    }
    if (fs.existsSync(resolved)) {
      return { cwd: resolved, isWsl: false }
    }
    throw new Error(`Working directory does not exist: ${options.cwd}`)
  }

  if (options.projectId) {
    throw new Error('projectId requires async resolution. Use resolveCwdForProject instead.')
  }

  return { cwd: os.homedir(), isWsl: false }
}

async function resolveCwdForProject(projectId: string): Promise<{ cwd: string; isWsl: boolean; linuxPath?: string }> {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const wslLocation = parseWslProjectPath(project.path)
  if (wslLocation) {
    return { cwd: wslLocation.uncPath, isWsl: true, linuxPath: wslLocation.linuxPath }
  }

  const normalizedPath = path.win32.normalize(project.path)
  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Project path does not exist: ${project.path}`)
  }

  return { cwd: normalizedPath, isWsl: false }
}

export class TerminalManager {
  private sessions = new Map<string, pty.IPty>()
  private sessionMeta = new Map<string, TerminalSession>()
  private broadcast: BroadcastFn

  constructor(broadcast: BroadcastFn) {
    this.broadcast = broadcast
  }

  async create(options: TerminalCreateOptions): Promise<TerminalSession> {
    const terminalId = randomUUID()
    const cols = options.cols ?? 80
    const rows = options.rows ?? 24

    let cwd: string
    let isWsl = false
    let linuxPath: string | undefined

    if (options.projectId) {
      const resolved = await resolveCwdForProject(options.projectId)
      cwd = resolved.cwd
      isWsl = resolved.isWsl
      linuxPath = resolved.linuxPath
    } else {
      const resolved = resolveWorkingDirectory(options)
      cwd = resolved.cwd
      isWsl = resolved.isWsl
    }

    const shell = await resolveShell(options)

    let ptyProcess: pty.IPty

    try {
      if (isWsl && linuxPath) {
        const wslLocation = parseWslProjectPath(cwd)
        const distro = wslLocation?.distro ?? 'Ubuntu'
        const targetLinuxPath = wslLocation?.linuxPath ?? linuxPath

        ptyProcess = pty.spawn('wsl.exe', ['-d', distro, '-e', 'bash', '-l'], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: targetLinuxPath,
          env: getCleanEnv(),
          useConpty: false,
        })
      } else {
        ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: getCleanEnv(),
          useConpty: false,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to spawn terminal.'
      this.broadcast('terminal:error', { terminalId, error: errorMessage })
      throw new Error(errorMessage)
    }

    const session: TerminalSession = {
      id: terminalId,
      projectId: options.projectId,
      cwd: isWsl && linuxPath ? linuxPath : cwd,
      shell: isWsl ? 'wsl.exe' : shell,
      createdAt: new Date().toISOString(),
      cols,
      rows,
    }

    this.sessions.set(terminalId, ptyProcess)
    this.sessionMeta.set(terminalId, session)

    ptyProcess.onData((data) => {
      this.broadcast('terminal:data', { terminalId, data })
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.sessions.delete(terminalId)
      this.sessionMeta.delete(terminalId)
      this.broadcast('terminal:exit', { terminalId, code: exitCode })
    })

    return session
  }

  write(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId)
    if (!session) {
      return
    }
    session.write(data)
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const session = this.sessions.get(terminalId)
    if (!session) {
      return
    }
    try {
      session.resize(cols, rows)
    } catch {
      // PTY may have already exited — ignore
      return
    }

    const meta = this.sessionMeta.get(terminalId)
    if (meta) {
      meta.cols = cols
      meta.rows = rows
    }
  }

  close(terminalId: string): void {
    const session = this.sessions.get(terminalId)
    if (!session) {
      return
    }

    session.kill()
    // onExit handler will clean up the maps
  }

  closeAll(): void {
    const ids = [...this.sessions.keys()]
    for (const terminalId of ids) {
      this.close(terminalId)
    }
  }

  get(terminalId: string): pty.IPty | undefined {
    return this.sessions.get(terminalId)
  }

  getSession(terminalId: string): TerminalSession | undefined {
    return this.sessionMeta.get(terminalId)
  }
}

export const terminalManager = new TerminalManager((channel, payload) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload)
  }
})
