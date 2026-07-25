/**
 * Engine Binary Management
 * Handles locating and spawning the devdesk-engine binary
 */

import { fork, spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type {
  EngineGitInsights,
  EngineIndexResult,
  EngineSearchResult,
  EngineStats,
  EngineStatus,
} from './types'
import {
  buildEngineGitArgs,
  buildEngineIndexArgs,
  buildEngineSearchArgs,
  buildEngineStatsArgs,
  getEngineDbPathFromUserData,
  resolveEngineBinaryPath,
} from './runtime'

const DEFAULT_ENGINE_TIMEOUT_MS = 120_000
const MAX_ENGINE_OUTPUT_BYTES = 8 * 1024 * 1024

function buildEngineNodePath(enginePath: string): string {
  const resourcesPath = typeof process.resourcesPath === 'string' ? process.resourcesPath : ''
  const nodePathEntries = [
    path.join(app.getAppPath(), 'node_modules'),
    resourcesPath ? path.join(resourcesPath, 'app.asar.unpacked', 'node_modules') : '',
    path.join(path.dirname(enginePath), 'node_modules'),
  ]

  return [
    ...nodePathEntries,
    process.env.NODE_PATH,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(path.delimiter)
}

function getEngineBinaryPath(): string {
  return resolveEngineBinaryPath({
    appPath: app.getAppPath(),
    moduleDirname: __dirname,
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    existsSync: fs.existsSync,
  })
}

export async function getEngineStatus(): Promise<EngineStatus> {
  const enginePath = getEngineBinaryPath()

  if (!fs.existsSync(enginePath)) {
    return {
      available: false,
      error: 'Engine binary not found',
    }
  }

  try {
    const result = await runEngineCommand(['--version'], { timeoutMs: 15_000 })
    return {
      available: true,
      version: result.trim(),
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function getEngineDbPath(projectId: string): string {
  return getEngineDbPathFromUserData(app.getPath('userData'), projectId)
}

export type RunEngineCommandOptions = {
  timeoutMs?: number
  maxOutputBytes?: number
  signal?: AbortSignal
}

function appendBounded(current: string, chunk: string, maxBytes: number, label: string): string {
  const next = current + chunk
  if (Buffer.byteLength(next, 'utf8') > maxBytes) {
    throw new Error(`Engine ${label} exceeded ${maxBytes} bytes`)
  }
  return next
}

function parseEngineJson<T>(stdout: string): T {
  const trimmed = stdout.trim()
  if (!trimmed) {
    throw new Error('Engine produced empty output')
  }
  try {
    return JSON.parse(trimmed) as T
  } catch (error) {
    throw new Error(
      `Malformed engine JSON output: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Run an engine command and return stdout (string). Bounded timeout/output; kill on hang.
 */
export async function runEngineCommand(
  args: string[],
  options: RunEngineCommandOptions = {},
): Promise<string> {
  const enginePath = getEngineBinaryPath()
  const timeoutMs = options.timeoutMs ?? DEFAULT_ENGINE_TIMEOUT_MS
  const maxOutputBytes = options.maxOutputBytes ?? MAX_ENGINE_OUTPUT_BYTES

  return new Promise((resolve, reject) => {
    let settled = false
    let stdout = ''
    let stderr = ''
    let child: ChildProcess

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      fn()
    }

    const killChild = (signal: NodeJS.Signals = 'SIGTERM') => {
      try {
        child.kill(signal)
      } catch {
        // ignore
      }
      if (process.platform === 'win32' && child.pid) {
        try {
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
        } catch {
          // ignore
        }
      }
    }

    const onAbort = () => {
      killChild()
      settle(() => reject(new Error('Engine command aborted')))
    }

    const timer = setTimeout(() => {
      killChild()
      settle(() => reject(new Error(`Engine command timed out after ${timeoutMs}ms`)))
    }, timeoutMs)

    try {
      const childEnv = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: buildEngineNodePath(enginePath),
      }

      child =
        path.extname(enginePath).toLowerCase() === '.js'
          ? fork(enginePath, args, {
              execPath: process.execPath,
              silent: true,
              env: childEnv,
            })
          : spawn(enginePath, args, {
              windowsHide: true,
              env: childEnv,
            })
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))))
      return
    }

    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) {
      onAbort()
      return
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      try {
        stdout = appendBounded(stdout, chunk.toString(), maxOutputBytes, 'stdout')
      } catch (error) {
        killChild()
        settle(() => reject(error instanceof Error ? error : new Error(String(error))))
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      try {
        stderr = appendBounded(stderr, chunk.toString(), maxOutputBytes, 'stderr')
      } catch (error) {
        killChild()
        settle(() => reject(error instanceof Error ? error : new Error(String(error))))
      }
    })

    child.on('error', (err: Error) => {
      settle(() => reject(err))
    })

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        settle(() => resolve(stdout))
        return
      }
      const detail = stderr.trim() || `Engine exited with code ${code}${signal ? ` signal ${signal}` : ''}`
      settle(() => reject(new Error(detail)))
    })
  })
}

export async function engineIndex(
  projectPath: string,
  projectId: string,
): Promise<EngineIndexResult> {
  const dbPath = getEngineDbPath(projectId)
  const result = await runEngineCommand(buildEngineIndexArgs(projectPath, dbPath), {
    timeoutMs: 300_000,
  })
  return parseEngineJson<EngineIndexResult>(result)
}

export async function engineSearch(
  projectId: string,
  query: string,
  options?: {
    regex?: boolean
    limit?: number
  },
): Promise<EngineSearchResult> {
  const dbPath = getEngineDbPath(projectId)
  const result = await runEngineCommand(buildEngineSearchArgs(query, dbPath, options), {
    timeoutMs: 60_000,
  })
  return parseEngineJson<EngineSearchResult>(result)
}

export async function engineStats(projectId: string): Promise<EngineStats> {
  const dbPath = getEngineDbPath(projectId)
  const result = await runEngineCommand(buildEngineStatsArgs(dbPath), { timeoutMs: 60_000 })
  return parseEngineJson<EngineStats>(result)
}

export async function engineGit(projectPath: string): Promise<EngineGitInsights> {
  const result = await runEngineCommand(buildEngineGitArgs(projectPath), { timeoutMs: 60_000 })
  const parsed = parseEngineJson<EngineGitInsights & { ok?: boolean; error?: string }>(result)

  if ('ok' in parsed && parsed.ok === false) {
    throw new Error(parsed.error || 'Failed to load git insights.')
  }

  return parsed
}

export type {
  EngineGitInsights,
  EngineIndexResult,
  EngineSearchResult,
  EngineStats,
  EngineStatus,
} from './types'
