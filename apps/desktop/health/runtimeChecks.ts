import fs from 'node:fs'
import path from 'node:path'

import type { HealthCheckItem } from '../data/model'

type CheckResult = Omit<HealthCheckItem, 'id' | 'runId'>

const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.production']
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
const LOCK_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Cargo.lock', 'go.sum']
const CONFIG_FILES = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'Makefile', 'makefile']

function exists(projectPath: string, entry: string): boolean {
  try {
    return fs.existsSync(path.join(projectPath, entry))
  } catch {
    return false
  }
}

function getMtimeMs(projectPath: string, entry: string): number | null {
  try {
    return fs.statSync(path.join(projectPath, entry)).mtimeMs
  } catch {
    return null
  }
}

// ── Individual checks ──────────────────────────────────────────────

export async function checkEnvFiles(projectPath: string): Promise<CheckResult> {
  if (!exists(projectPath, '.')) {
    return {
      category: 'project',
      key: 'env-files',
      label: 'Environment files',
      status: 'fail',
      message: 'Project path does not exist or is not accessible.',
      detailsJson: '{}',
      suggestedFix: 'Verify the project path is correct.',
    }
  }

  const found = ENV_FILES.filter((file) => exists(projectPath, file))
  const foundList = found.length > 0 ? found.join(', ') : 'none'

  return {
    category: 'project',
    key: 'env-files',
    label: 'Environment files',
    status: found.length > 0 ? 'pass' : 'warning',
    message: found.length > 0
      ? `Found: ${foundList}`
      : 'No .env files found.',
    detailsJson: JSON.stringify({ found, lookedFor: ENV_FILES }),
    suggestedFix: found.length === 0
      ? 'Create a .env file in the project root with required environment variables.'
      : '',
  }
}

export async function checkDependenciesInstalled(projectPath: string): Promise<CheckResult> {
  const hasPackageJson = exists(projectPath, 'package.json')
  const hasNodeModules = exists(projectPath, 'node_modules')

  if (!hasPackageJson) {
    return {
      category: 'project',
      key: 'dependencies',
      label: 'Dependencies installed',
      status: 'skipped',
      message: 'No package.json found; skipping dependency check.',
      detailsJson: '{}',
      suggestedFix: '',
    }
  }

  if (!hasNodeModules) {
    // Check if any lockfile exists (indicates dependencies were declared but not installed)
    const hasLockfile = LOCK_FILES.some((file) => exists(projectPath, file))

    return {
      category: 'project',
      key: 'dependencies',
      label: 'Dependencies installed',
      status: 'fail',
      message: hasLockfile
        ? 'Lockfile found but node_modules is missing. Run install.'
        : 'node_modules is missing. Run npm install (or your package manager equivalent).',
      detailsJson: JSON.stringify({ hasPackageJson: true, hasNodeModules: false, hasLockfile }),
      suggestedFix: 'Run npm install (or your package manager equivalent) to install dependencies.',
    }
  }

  // Check lockfile vs package.json staleness
  const pkgMtime = getMtimeMs(projectPath, 'package.json')
  let lockfileStale = false
  let lockfileName = ''

  for (const lockfile of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
    const lockMtime = getMtimeMs(projectPath, lockfile)
    if (lockMtime !== null && pkgMtime !== null && pkgMtime > lockMtime) {
      lockfileStale = true
      lockfileName = lockfile
      break
    }
  }

  if (lockfileStale) {
    return {
      category: 'project',
      key: 'dependencies',
      label: 'Dependencies installed',
      status: 'warning',
      message: `package.json was modified after ${lockfileName}. Dependencies may be out of sync.`,
      detailsJson: JSON.stringify({
        hasPackageJson: true,
        hasNodeModules: true,
        pkgMtime: pkgMtime ? new Date(pkgMtime).toISOString() : null,
        lockfileStale: true,
        lockfileName,
      }),
      suggestedFix: `Run install to sync ${lockfileName} with package.json.`,
    }
  }

  return {
    category: 'project',
    key: 'dependencies',
    label: 'Dependencies installed',
    status: 'pass',
    message: 'node_modules is present and appears up to date.',
    detailsJson: JSON.stringify({ hasPackageJson: true, hasNodeModules: true, lockfileStale: false }),
    suggestedFix: '',
  }
}

export async function checkProjectConfigFiles(projectPath: string): Promise<CheckResult> {
  const found = CONFIG_FILES.filter((file) => exists(projectPath, file))
  const missing = CONFIG_FILES.filter((file) => !found.includes(file))

  return {
    category: 'project',
    key: 'config-files',
    label: 'Project config files',
    status: found.length > 0 ? 'pass' : 'warning',
    message: found.length > 0
      ? `Found: ${found.join(', ')}`
      : 'No recognized project config files found.',
    detailsJson: JSON.stringify({ found, missing }),
    suggestedFix: found.length === 0
      ? 'Initialize a project with a standard config file (package.json, pyproject.toml, Cargo.toml, etc.).'
      : '',
  }
}

export async function checkDockerComposePresent(projectPath: string): Promise<CheckResult> {
  const found = COMPOSE_FILES.filter((file) => exists(projectPath, file))

  return {
    category: 'project',
    key: 'docker-compose',
    label: 'Docker Compose configuration',
    status: found.length > 0 ? 'pass' : 'skipped',
    message: found.length > 0
      ? `Found: ${found[0]}`
      : 'No Docker Compose file found.',
    detailsJson: JSON.stringify({ found }),
    suggestedFix: '',
  }
}

export async function checkPortsAvailable(_projectPath: string): Promise<CheckResult> {
  return {
    category: 'project',
    key: 'ports',
    label: 'Port availability',
    status: 'skipped',
    message: 'Port checking is not yet implemented.',
    detailsJson: '{}',
    suggestedFix: '',
  }
}

export async function checkDatabaseReachable(_projectPath: string): Promise<CheckResult> {
  return {
    category: 'project',
    key: 'database',
    label: 'Database reachable',
    status: 'skipped',
    message: 'Database connectivity checking is not yet implemented.',
    detailsJson: '{}',
    suggestedFix: '',
  }
}

// ── Aggregator ─────────────────────────────────────────────────────

const ALL_RUNTIME_CHECKS: Array<(projectPath: string) => Promise<CheckResult>> = [
  checkEnvFiles,
  checkDependenciesInstalled,
  checkProjectConfigFiles,
  checkDockerComposePresent,
  checkPortsAvailable,
  checkDatabaseReachable,
]

/**
 * Runs all project-level / runtime health checks for a given project path.
 *
 * Each check returns a result regardless of success or failure — this
 * function never throws.
 */
export async function runRuntimeChecks(projectPath: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  for (const check of ALL_RUNTIME_CHECKS) {
    try {
      results.push(await check(projectPath))
    } catch (error) {
      results.push({
        category: 'project',
        key: 'unknown',
        label: 'Unknown check',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unexpected error during runtime check.',
        detailsJson: '{}',
        suggestedFix: '',
      })
    }
  }

  return results
}
