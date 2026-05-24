import { describe, expect, it, vi } from 'vitest'

import type { SystemCheckResult } from '../system/runner'

// Mock the entire runner module
vi.mock('../system/runner', () => ({
  runSystemCheck: vi.fn<(command: string, args: string[], options?: Record<string, unknown>) => Promise<SystemCheckResult>>(),
  TRUNCATION_MARKER: '\n...[output truncated]',
}))

async function importSystemChecks() {
  return import('../health/systemChecks')
}

function mockResult(overrides: Partial<SystemCheckResult> = {}): SystemCheckResult {
  return {
    ok: true,
    stdout: '',
    stderr: '',
    code: 0,
    ...overrides,
  }
}

describe('systemChecks', () => {
  describe('checkNodeInstalled', () => {
    it('passes when node --version succeeds', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck).mockResolvedValueOnce(mockResult({ ok: true, stdout: 'v20.11.0\n', code: 0 }))

      const { checkNodeInstalled } = await importSystemChecks()
      const result = await checkNodeInstalled()

      expect(result.status).toBe('pass')
      expect(result.key).toBe('node')
      expect(result.message).toContain('20.11.0')
      expect(JSON.parse(result.detailsJson).version).toBe('20.11.0')
    })

    it('fails when node is not found', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck).mockResolvedValueOnce(mockResult({ ok: false, code: 1 }))

      const { checkNodeInstalled } = await importSystemChecks()
      const result = await checkNodeInstalled()

      expect(result.status).toBe('fail')
      expect(result.suggestedFix).toContain('https://nodejs.org')
    })
  })

  describe('checkPythonInstalled', () => {
    it('tries python3 first, falls back to python', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck)
        .mockResolvedValueOnce(mockResult({ ok: false, code: 1 })) // python3 fails
        .mockResolvedValueOnce(mockResult({ ok: true, stdout: 'Python 3.12.0\n', code: 0 })) // python succeeds

      const { checkPythonInstalled } = await importSystemChecks()
      const result = await checkPythonInstalled()

      expect(result.status).toBe('pass')
      expect(JSON.parse(result.detailsJson).version).toBe('3.12.0')
    })

    it('fails when neither python3 nor python are found', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck)
        .mockResolvedValueOnce(mockResult({ ok: false }))
        .mockResolvedValueOnce(mockResult({ ok: false }))

      const { checkPythonInstalled } = await importSystemChecks()
      const result = await checkPythonInstalled()

      expect(result.status).toBe('fail')
    })
  })

  describe('checkGitInstalled', () => {
    it('passes with git version', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck).mockResolvedValueOnce(mockResult({ ok: true, stdout: 'git version 2.43.0\n', code: 0 }))

      const { checkGitInstalled } = await importSystemChecks()
      const result = await checkGitInstalled()

      expect(result.status).toBe('pass')
      expect(JSON.parse(result.detailsJson).version).toBe('2.43.0')
    })
  })

  describe('checkDockerInstalled', () => {
    it('passes with docker version', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck).mockResolvedValueOnce(mockResult({
        ok: true,
        stdout: 'Docker version 24.0.7, build afdd53b\n',
        code: 0,
      }))

      const { checkDockerInstalled } = await importSystemChecks()
      const result = await checkDockerInstalled()

      expect(result.status).toBe('pass')
    })
  })

  describe('checkDockerDaemonRunning', () => {
    it('skips when docker CLI is not installed', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck).mockResolvedValueOnce(mockResult({ ok: false })) // CLI check

      const { checkDockerDaemonRunning } = await importSystemChecks()
      const result = await checkDockerDaemonRunning()

      expect(result.status).toBe('skipped')
    })

    it('warns when daemon is not reachable', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck)
        .mockResolvedValueOnce(mockResult({ ok: true, code: 0 })) // CLI installed
        .mockResolvedValueOnce(mockResult({ ok: false, code: 1 })) // daemon down

      const { checkDockerDaemonRunning } = await importSystemChecks()
      const result = await checkDockerDaemonRunning()

      expect(result.status).toBe('warning')
      expect(result.suggestedFix).toContain('Start Docker')
    })

    it('passes when daemon is running', async () => {
      const { runSystemCheck } = await import('../system/runner')
      vi.mocked(runSystemCheck)
        .mockResolvedValueOnce(mockResult({ ok: true, code: 0 }))
        .mockResolvedValueOnce(mockResult({ ok: true, code: 0 }))

      const { checkDockerDaemonRunning } = await importSystemChecks()
      const result = await checkDockerDaemonRunning()

      expect(result.status).toBe('pass')
    })
  })

  describe('package manager checks', () => {
    const pms = [
      { fn: 'checkNpmInstalled', key: 'npm', version: '10.2.4' },
      { fn: 'checkYarnInstalled', key: 'yarn', version: '1.22.19' },
      { fn: 'checkPnpmInstalled', key: 'pnpm', version: '8.10.0' },
      { fn: 'checkPipInstalled', key: 'pip', version: '23.3.1' },
      { fn: 'checkPoetryInstalled', key: 'poetry', version: '1.7.1' },
      { fn: 'checkCargoInstalled', key: 'cargo', version: '1.74.0' },
      { fn: 'checkGoInstalled', key: 'go', version: '1.21.4' },
    ]

    for (const pm of pms) {
      it(`${pm.fn} passes when installed`, async () => {
        const { runSystemCheck } = await import('../system/runner')
        // Reset mock calls for each test
        vi.clearAllMocks()
        vi.mocked(runSystemCheck).mockResolvedValue(mockResult({ ok: true, stdout: `${pm.version}\n`, code: 0 }))

        const mod = await importSystemChecks()
        const fn = mod[pm.fn as keyof typeof mod] as () => Promise<{ status: string; key: string }>
        const result = await fn()

        expect(result.status).toBe('pass')
        expect(result.key).toBe(pm.key)
      })

      it(`${pm.fn} fails when missing`, async () => {
        const { runSystemCheck } = await import('../system/runner')
        vi.clearAllMocks()
        vi.mocked(runSystemCheck).mockResolvedValue(mockResult({ ok: false, code: 1 }))

        const mod = await importSystemChecks()
        const fn = mod[pm.fn as keyof typeof mod] as () => Promise<{ status: string; key: string }>
        const result = await fn()

        expect(result.status).toBe('fail')
      })
    }
  })

  describe('runSystemChecks', () => {
    it('runs all checks and returns results', async () => {
      const { runSystemCheck } = await import('../system/runner')
      // All checks succeed
      vi.mocked(runSystemCheck).mockResolvedValue(mockResult({ ok: true, stdout: '1.0.0\n', code: 0 }))

      const { runSystemChecks } = await importSystemChecks()
      const results = await runSystemChecks()

      // 12 system checks
      expect(results.length).toBe(12)
      expect(results.every((r) => r.category === 'system')).toBe(true)
    })
  })
})
