export const WINDOWS_DOCKER_DAEMON_ERROR =
  'Docker daemon is not running. Start Docker Desktop and try again.'

export function isWslUnavailableError(error: unknown): boolean {
  const err = error as NodeJS.ErrnoException
  if (err?.code === 'ENOENT') {
    return true
  }

  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  return (
    message.includes('wsl is not installed') ||
    message.includes('the windows subsystem for linux is not installed') ||
    message.includes('windows subsystem for linux has no installed distributions') ||
    message.includes('there are no distributions installed') ||
    message.includes('no installed distributions')
  )
}

export function shouldAttemptWslFallback(error: unknown): boolean {
  return !isWslUnavailableError(error)
}

export function parseWslQuietDistroList(output: string): string[] {
  return output
    .replace(/\u0000/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function formatWindowsDockerDaemonPrimaryError(originalMessage?: string): string {
  const trimmed = originalMessage?.replace(/\u0000/g, '').trim()
  return trimmed || WINDOWS_DOCKER_DAEMON_ERROR
}

export function formatWindowsDockerDaemonFallbackError(primaryMessage: string, wslError: unknown): string {
  const primary = formatWindowsDockerDaemonPrimaryError(primaryMessage)
  const wslMessage =
    wslError instanceof Error && wslError.message.trim() ? wslError.message.trim() : 'Unknown error'
  return `${primary} (WSL fallback also failed: ${wslMessage})`
}
