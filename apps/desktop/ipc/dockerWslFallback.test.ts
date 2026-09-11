import { describe, expect, it } from 'vitest'
import {
  formatWindowsDockerDaemonFallbackError,
  formatWindowsDockerDaemonPrimaryError,
  isWslUnavailableError,
  parseWslQuietDistroList,
  shouldAttemptWslFallback,
  WINDOWS_DOCKER_DAEMON_ERROR,
} from './dockerWslFallback'

describe('docker WSL fallback helpers', () => {
  it('treats missing wsl.exe as unavailable and skips fallback', () => {
    const missing = Object.assign(new Error('spawn wsl ENOENT'), { code: 'ENOENT' })
    expect(isWslUnavailableError(missing)).toBe(true)
    expect(shouldAttemptWslFallback(missing)).toBe(false)
  })

  it('treats WSL-not-installed messages as unavailable', () => {
    const error = new Error('The Windows Subsystem for Linux is not installed.')
    expect(isWslUnavailableError(error)).toBe(true)
    expect(shouldAttemptWslFallback(error)).toBe(false)
  })

  it('attempts fallback for ordinary daemon/distro errors', () => {
    const error = new Error('Cannot connect to the Docker daemon')
    expect(isWslUnavailableError(error)).toBe(false)
    expect(shouldAttemptWslFallback(error)).toBe(true)
  })

  it('keeps the primary Windows daemon error first and suffixes WSL details', () => {
    const primary = formatWindowsDockerDaemonPrimaryError('Cannot connect to the Docker daemon')
    expect(primary).toBe('Cannot connect to the Docker daemon')
    expect(primary).not.toMatch(/Docker Desktop daemon/)

    const message = formatWindowsDockerDaemonFallbackError(primary, new Error('docker not found in Ubuntu'))
    expect(message.startsWith(primary)).toBe(true)
    expect(message).toContain('WSL fallback also failed: docker not found in Ubuntu')
  })

  it('falls back to the generic daemon message when the original is empty', () => {
    expect(formatWindowsDockerDaemonPrimaryError('  ')).toBe(WINDOWS_DOCKER_DAEMON_ERROR)
  })

  it('parses quiet WSL distro lists', () => {
    expect(parseWslQuietDistroList('Ubuntu\0\r\nDebian\n\n')).toEqual(['Ubuntu', 'Debian'])
  })
})
