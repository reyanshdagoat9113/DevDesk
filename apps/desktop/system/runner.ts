import { spawn } from 'node:child_process'
import type { SpawnOptions } from 'node:child_process'

/**
 * Result of a system check command execution.
 * The promise never rejects — all failure modes are surfaced here.
 */
export type SystemCheckResult = {
  /** true when the process exited with code 0 */
  ok: boolean
  /** Collected stdout (truncated if exceeded maxBuffer) */
  stdout: string
  /** Collected stderr (truncated if exceeded maxBuffer), or error message on spawn failure */
  stderr: string
  /** Process exit code — null indicates the process never started or was killed */
  code: number | null
}

/** Optional configuration for runSystemCheck */
export type SystemCheckOptions = {
  /** Max milliseconds before the child is killed. Default: 30000 (30s). Use 0 or Infinity to disable. */
  timeout?: number
  /** Max characters collected for stdout and stderr each. Default: 1048576 (1 MiB). Truncation works at the character (UTF-16 code unit) level. */
  maxBuffer?: number
  /** Working directory for the spawned process. Default: process.cwd() */
  cwd?: string
}

const DEFAULT_TIMEOUT = 30_000
const DEFAULT_MAX_BUFFER = 1_048_576

/** @internal — exported for test assertions against truncation behavior */
export const TRUNCATION_MARKER = '\n...[output truncated]'

function cleanOutput(value: string): string {
  return value.replace(/\u0000/g, '')
}

function bufferAppend(existing: string, chunk: Buffer, maxChars: number): string {
  if (existing.length >= maxChars) return existing
  const appended = existing + chunk.toString()
  if (appended.length > maxChars) {
    return appended.slice(0, maxChars) + TRUNCATION_MARKER
  }
  return appended
}

/**
 * Runs a system command with timeout and buffer protection.
 *
 * Never throws — non-zero exits, spawn errors, and timeouts are all surfaced
 * via the returned {@link SystemCheckResult} object. On Windows, automatically
 * retries with `shell: true` when the initial spawn fails with ENOENT.
 *
 * @param command - The executable name or path (must resolve via PATH on Unix; .cmd/.bat wrappers auto-detected on Windows)
 * @param args - Command arguments as an array (prevents shell injection)
 * @param options - Optional timeout, buffer character limit, and working directory
 * @returns A promise that always resolves with a structured result
 */
export function runSystemCheck(
  command: string,
  args: string[] = [],
  options: SystemCheckOptions = {}
): Promise<SystemCheckResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const maxChars = options.maxBuffer ?? DEFAULT_MAX_BUFFER
  const hasTimeout = timeout > 0 && Number.isFinite(timeout)

  return new Promise<SystemCheckResult>((resolve) => {
    const doSpawn = (shell: boolean): void => {
      const spawnOpts: SpawnOptions = {
        cwd: options.cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell,
      }

      const child = spawn(command, args, spawnOpts)

      let stdout = ''
      let stderr = ''
      let timedOut = false

      let timer: NodeJS.Timeout | undefined
      let forceKillTimer: NodeJS.Timeout | undefined

      if (hasTimeout) {
        timer = setTimeout(() => {
          timedOut = true
          if (process.platform === 'win32') {
            child.kill()
          } else {
            child.kill('SIGTERM')
          }
          forceKillTimer = setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL')
            }
          }, 3000)
        }, timeout)
      }

      const clearTimers = () => {
        if (timer) clearTimeout(timer)
        if (forceKillTimer) clearTimeout(forceKillTimer)
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout = bufferAppend(stdout, chunk, maxChars)
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = bufferAppend(stderr, chunk, maxChars)
      })

      child.on('error', (error: NodeJS.ErrnoException) => {
        clearTimers()
        if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'ENOENT' && !shell) {
          doSpawn(true)
          return
        }
        resolve({
          ok: false,
          stdout: '',
          stderr: error.message,
          code: null,
        })
      })

      child.on('close', (code: number | null) => {
        clearTimers()
        if (timedOut) {
          resolve({
            ok: false,
            stdout: cleanOutput(stdout),
            stderr: stderr
              ? `${cleanOutput(stderr)}\nCommand timed out after ${timeout}ms`
              : `Command timed out after ${timeout}ms`,
            code: null,
          })
        } else {
          resolve({
            ok: code === 0,
            stdout: cleanOutput(stdout),
            stderr: cleanOutput(stderr),
            code,
          })
        }
      })
    }

    doSpawn(false)
  })
}
