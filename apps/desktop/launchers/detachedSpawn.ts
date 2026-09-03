import { spawn } from 'node:child_process'

export type SpawnDetachedOptions = {
  shell?: boolean
  windowsHide?: boolean
}

const CMD_UNSAFE_PATTERN = /[\s&()^%!"<>|]/

export function quoteCmdArgIfNeeded(value: string) {
  if (!CMD_UNSAFE_PATTERN.test(value)) {
    return value
  }
  return `"${value.replace(/"/g, '""')}"`
}

export function spawnDetached(command: string, args: string[], options: SpawnDetachedOptions = {}) {
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

export function spawnShellDetached(command: string, options: SpawnDetachedOptions = {}) {
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

function shouldRetryDetachedWithShell(error?: string) {
  if (!error) {
    return false
  }

  const normalized = error.toLowerCase()
  return normalized.includes('enoent') || normalized.includes('not recognized as an internal or external command')
}

export async function spawnDetachedWithShellFallback(command: string, args: string[], options: SpawnDetachedOptions = {}) {
  const result = await spawnDetached(command, args, options)
  if (result.success || process.platform !== 'win32' || options.shell || !shouldRetryDetachedWithShell(result.error)) {
    return result
  }

  return spawnDetached(command, args.map(quoteCmdArgIfNeeded), { ...options, shell: true })
}
