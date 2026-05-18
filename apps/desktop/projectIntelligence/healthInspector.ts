import fs from 'node:fs'
import path from 'node:path'

import type {
  HealthSuggestion,
  Project,
  ProjectHealthReport,
  ProjectHealthStatus,
  ProjectPackageManager,
} from '../data/model'

type PackageJson = {
  scripts?: Record<string, unknown>
  engines?: {
    node?: unknown
  }
}

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']

function exists(projectPath: string, entry: string): boolean {
  return fs.existsSync(path.join(projectPath, entry))
}

function readTextFile(projectPath: string, entry: string): string | null {
  try {
    return fs.readFileSync(path.join(projectPath, entry), 'utf8')
  } catch {
    return null
  }
}

function readPackageJson(projectPath: string): PackageJson | null {
  const raw = readTextFile(projectPath, 'package.json')
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as PackageJson : null
  } catch {
    return null
  }
}

function detectPackageManager(projectPath: string, projectType: Project['type']): ProjectPackageManager | undefined {
  if (exists(projectPath, 'pnpm-lock.yaml')) return 'pnpm'
  if (exists(projectPath, 'yarn.lock')) return 'yarn'
  if (exists(projectPath, 'package-lock.json')) return 'npm'
  if (exists(projectPath, 'package.json')) return 'npm'
  if (exists(projectPath, 'poetry.lock') || exists(projectPath, 'pyproject.toml')) return 'poetry'
  if (exists(projectPath, 'requirements.txt') || projectType === 'python') return 'pip'
  if (exists(projectPath, 'Cargo.toml') || projectType === 'rust') return 'cargo'
  if (exists(projectPath, 'go.mod') || projectType === 'go') return 'go'
  return undefined
}

function hasLockfile(projectPath: string): boolean {
  return [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'poetry.lock',
    'Cargo.lock',
    'go.sum',
  ].some((entry) => exists(projectPath, entry))
}

function detectNodeVersion(projectPath: string, packageJson: PackageJson | null): string | undefined {
  const nvmrc = readTextFile(projectPath, '.nvmrc')?.trim()
  if (nvmrc) {
    return nvmrc
  }

  const nodeVersion = readTextFile(projectPath, '.node-version')?.trim()
  if (nodeVersion) {
    return nodeVersion
  }

  const engineVersion = packageJson?.engines?.node
  return typeof engineVersion === 'string' && engineVersion.trim() ? engineVersion.trim() : undefined
}

function detectAvailableScripts(projectPath: string, packageJson: PackageJson | null): string[] {
  const scripts = new Set<string>()

  if (packageJson?.scripts && typeof packageJson.scripts === 'object') {
    for (const [name, value] of Object.entries(packageJson.scripts)) {
      if (typeof value === 'string' && name.trim()) {
        scripts.add(name)
      }
    }
  }

  const makefile = readTextFile(projectPath, 'Makefile') ?? readTextFile(projectPath, 'makefile')
  if (makefile) {
    for (const line of makefile.split(/\r?\n/)) {
      const match = /^([A-Za-z0-9][A-Za-z0-9_.-]*):(?:\s|$)/.exec(line)
      if (match && !match[1].includes('.')) {
        scripts.add(`make ${match[1]}`)
      }
    }
  }

  return Array.from(scripts).sort((a, b) => a.localeCompare(b))
}

function getInstallCommand(packageManager?: ProjectPackageManager): string | undefined {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install'
    case 'yarn':
      return 'yarn install'
    case 'npm':
      return 'npm install'
    case 'poetry':
      return 'poetry install'
    case 'pip':
      return 'pip install -r requirements.txt'
    case 'cargo':
      return 'cargo fetch'
    case 'go':
      return 'go mod download'
    default:
      return undefined
  }
}

function buildSuggestions(input: {
  packageManager?: ProjectPackageManager
  missingDeps: boolean
  hasGit: boolean
  hasDockerCompose: boolean
  availableScripts: string[]
}): HealthSuggestion[] {
  const suggestions: HealthSuggestion[] = []

  if (input.missingDeps) {
    const command = getInstallCommand(input.packageManager)
    suggestions.push({
      id: 'missing-dependencies',
      type: 'warning',
      message: 'Dependencies appear to be missing for this project.',
      action: command ? { label: 'Install dependencies', command } : undefined,
    })
  }

  if (input.availableScripts.length > 0) {
    const preferredScript = ['dev', 'start', 'test', 'build', 'lint'].find((script) => input.availableScripts.includes(script))
    const command = preferredScript && input.packageManager
      ? `${input.packageManager === 'yarn' ? 'yarn' : input.packageManager === 'pnpm' ? 'pnpm' : 'npm run'} ${preferredScript}`
      : undefined

    suggestions.push({
      id: 'available-scripts',
      type: 'info',
      message: `${input.availableScripts.length} runnable script${input.availableScripts.length === 1 ? '' : 's'} detected.`,
      action: command ? { label: `Run ${preferredScript}`, command } : undefined,
    })
  }

  if (input.hasDockerCompose) {
    suggestions.push({
      id: 'docker-compose-detected',
      type: 'info',
      message: 'Docker Compose configuration detected.',
    })
  }

  if (input.hasGit) {
    suggestions.push({
      id: 'git-detected',
      type: 'success',
      message: 'Git repository detected.',
    })
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'no-issues',
      type: 'success',
      message: 'No setup issues detected from the shallow project inspection.',
    })
  }

  return suggestions
}

function getStatus(suggestions: HealthSuggestion[]): ProjectHealthStatus {
  if (suggestions.some((suggestion) => suggestion.type === 'warning')) {
    return 'warning'
  }
  return 'healthy'
}

function inspectExistingProject(project: Project): ProjectHealthReport {
  const projectPath = project.path
  const packageJson = readPackageJson(projectPath)
  const packageManager = detectPackageManager(projectPath, project.type)
  const lockfile = hasLockfile(projectPath)
  const hasNodeModules = exists(projectPath, 'node_modules')
  const hasGit = exists(projectPath, '.git')
  const hasDockerCompose = COMPOSE_FILES.some((entry) => exists(projectPath, entry))
  const availableScripts = detectAvailableScripts(projectPath, packageJson)
  const nodeVersion = detectNodeVersion(projectPath, packageJson)
  const isNodeProject = packageManager === 'npm' || packageManager === 'yarn' || packageManager === 'pnpm'
  const missingDeps = isNodeProject && (exists(projectPath, 'package.json') || lockfile) && !hasNodeModules
  const suggestions = buildSuggestions({
    packageManager,
    missingDeps,
    hasGit,
    hasDockerCompose,
    availableScripts,
  })

  return {
    projectId: project.id,
    analyzedAt: new Date().toISOString(),
    packageManager,
    hasNodeModules: isNodeProject ? hasNodeModules : undefined,
    hasLockfile: lockfile,
    hasDockerCompose,
    hasGit,
    nodeVersion,
    availableScripts,
    missingDeps,
    status: getStatus(suggestions),
    suggestions,
  }
}

export function inspectProjectHealth(project: Project): ProjectHealthReport {
  try {
    if (!fs.existsSync(project.path)) {
      return {
        projectId: project.id,
        analyzedAt: new Date().toISOString(),
        status: 'critical',
        suggestions: [{
          id: 'project-path-missing',
          type: 'warning',
          message: 'Project path does not exist or is not accessible.',
        }],
      }
    }

    return inspectExistingProject(project)
  } catch (error) {
    return {
      projectId: project.id,
      analyzedAt: new Date().toISOString(),
      status: 'critical',
      suggestions: [{
        id: 'inspection-failed',
        type: 'warning',
        message: error instanceof Error ? error.message : 'Project inspection failed.',
      }],
    }
  }
}
