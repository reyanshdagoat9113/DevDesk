import type { HealthCheckItem } from '../data/model'
import { runSystemCheck } from '../system/runner'

type CheckResult = Omit<HealthCheckItem, 'id' | 'runId'>

/**
 * Extracts a semver-like version string from command output.
 * Matches patterns like "v20.11.0", "3.12.0", "1.21.4".
 */
function extractVersion(stdout: string): string | undefined {
  return /(\d+\.\d+\.\d+)/.exec(stdout)?.[1]
}

function failResult(key: string, label: string, toolName: string, installUrl: string): CheckResult {
  return {
    category: 'system',
    key,
    label,
    status: 'fail',
    message: `${toolName} is not installed or not in PATH.`,
    detailsJson: '{}',
    suggestedFix: `Install ${toolName} from ${installUrl}`,
  }
}

function passResult(key: string, label: string, version: string | undefined, stdout: string, stderr: string): CheckResult {
  return {
    category: 'system',
    key,
    label,
    status: 'pass',
    message: version ? `${label.split(' ')[0]} ${version}` : label,
    detailsJson: JSON.stringify({ version, raw: stdout, stderr }),
    suggestedFix: '',
  }
}

function skipResult(key: string, label: string, reason: string): CheckResult {
  return {
    category: 'system',
    key,
    label,
    status: 'skipped',
    message: reason,
    detailsJson: '{}',
    suggestedFix: '',
  }
}

// ── Individual checks ──────────────────────────────────────────────

export async function checkNodeInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('node', ['--version'])
  if (!result.ok || result.code !== 0) {
    return failResult('node', 'Node.js installed', 'Node.js', 'https://nodejs.org/')
  }
  const version = extractVersion(result.stdout)
  return passResult('node', 'Node.js installed', version, result.stdout, result.stderr)
}

export async function checkPythonInstalled(): Promise<CheckResult> {
  // Try python3 first, then python
  let result = await runSystemCheck('python3', ['--version'])
  if (!result.ok) {
    result = await runSystemCheck('python', ['--version'])
  }
  if (!result.ok || result.code !== 0) {
    return failResult('python', 'Python installed', 'Python', 'https://www.python.org/downloads/')
  }
  // Python outputs version to stderr on some platforms
  const version = extractVersion(result.stdout) ?? extractVersion(result.stderr)
  return passResult('python', 'Python installed', version, result.stdout, result.stderr)
}

export async function checkGitInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('git', ['--version'])
  if (!result.ok || result.code !== 0) {
    return failResult('git', 'Git installed', 'Git', 'https://git-scm.com/')
  }
  const version = extractVersion(result.stdout)
  return passResult('git', 'Git installed', version, result.stdout, result.stderr)
}

export async function checkDockerInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('docker', ['--version'])
  if (!result.ok || result.code !== 0) {
    return failResult('docker', 'Docker CLI installed', 'Docker', 'https://www.docker.com/products/docker-desktop/')
  }
  const version = extractVersion(result.stdout)
  return passResult('docker', 'Docker CLI installed', version, result.stdout, result.stderr)
}

export async function checkDockerDaemonRunning(): Promise<CheckResult> {
  // Only check daemon if Docker CLI is available
  const cli = await runSystemCheck('docker', ['--version'])
  if (!cli.ok) {
    return skipResult('docker-daemon', 'Docker daemon running', 'Docker CLI not installed; daemon check skipped.')
  }

  const result = await runSystemCheck('docker', ['info'], { timeout: 15000 })
  if (!result.ok) {
    return {
      category: 'system',
      key: 'docker-daemon',
      label: 'Docker daemon running',
      status: 'warning',
      message: 'Docker daemon does not appear to be running.',
      detailsJson: JSON.stringify({ raw: result.stdout, stderr: result.stderr }),
      suggestedFix: 'Start Docker Desktop or the Docker daemon.',
    }
  }
  return {
    category: 'system',
    key: 'docker-daemon',
    label: 'Docker daemon running',
    status: 'pass',
    message: 'Docker daemon is running.',
    detailsJson: '{}',
    suggestedFix: '',
  }
}

export async function checkNpmInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('npm', ['--version'])
  if (!result.ok) {
    return failResult('npm', 'npm available', 'npm', 'https://nodejs.org/')
  }
  const version = result.stdout.trim()
  return passResult('npm', 'npm available', version, result.stdout, result.stderr)
}

export async function checkYarnInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('yarn', ['--version'])
  if (!result.ok) {
    return failResult('yarn', 'yarn available', 'Yarn', 'https://yarnpkg.com/')
  }
  const version = result.stdout.trim()
  return passResult('yarn', 'yarn available', version, result.stdout, result.stderr)
}

export async function checkPnpmInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('pnpm', ['--version'])
  if (!result.ok) {
    return failResult('pnpm', 'pnpm available', 'pnpm', 'https://pnpm.io/installation')
  }
  const version = result.stdout.trim()
  return passResult('pnpm', 'pnpm available', version, result.stdout, result.stderr)
}

export async function checkPipInstalled(): Promise<CheckResult> {
  let result = await runSystemCheck('pip3', ['--version'])
  if (!result.ok) {
    result = await runSystemCheck('pip', ['--version'])
  }
  if (!result.ok) {
    return failResult('pip', 'pip available', 'pip', 'https://pip.pypa.io/en/stable/installation/')
  }
  const version = extractVersion(result.stdout)
  return passResult('pip', 'pip available', version, result.stdout, result.stderr)
}

export async function checkPoetryInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('poetry', ['--version'])
  if (!result.ok) {
    return failResult('poetry', 'Poetry available', 'Poetry', 'https://python-poetry.org/docs/#installation')
  }
  const version = extractVersion(result.stdout) ?? result.stdout.trim()
  return passResult('poetry', 'Poetry available', version, result.stdout, result.stderr)
}

export async function checkCargoInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('cargo', ['--version'])
  if (!result.ok) {
    return failResult('cargo', 'Cargo available', 'Cargo', 'https://rustup.rs/')
  }
  const version = extractVersion(result.stdout)
  return passResult('cargo', 'Cargo available', version, result.stdout, result.stderr)
}

export async function checkGoInstalled(): Promise<CheckResult> {
  const result = await runSystemCheck('go', ['version'])
  if (!result.ok) {
    return failResult('go', 'Go available', 'Go', 'https://go.dev/dl/')
  }
  const version = extractVersion(result.stdout)
  return passResult('go', 'Go available', version, result.stdout, result.stderr)
}

// ── Aggregator ─────────────────────────────────────────────────────

const ALL_SYSTEM_CHECKS: Array<() => Promise<CheckResult>> = [
  checkNodeInstalled,
  checkPythonInstalled,
  checkGitInstalled,
  checkDockerInstalled,
  checkDockerDaemonRunning,
  checkNpmInstalled,
  checkYarnInstalled,
  checkPnpmInstalled,
  checkPipInstalled,
  checkPoetryInstalled,
  checkCargoInstalled,
  checkGoInstalled,
]

/**
 * Runs all system-level health checks.
 *
 * Checks are executed sequentially to avoid spawning too many child processes
 * at once. Each check returns a result regardless of success or failure —
 * this function never throws.
 */
export async function runSystemChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  for (const check of ALL_SYSTEM_CHECKS) {
    try {
      results.push(await check())
    } catch (error) {
      results.push({
        category: 'system',
        key: 'unknown',
        label: 'Unknown check',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unexpected error during system check.',
        detailsJson: '{}',
        suggestedFix: '',
      })
    }
  }

  return results
}
