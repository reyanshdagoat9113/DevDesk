import * as path from 'node:path'

export function resolveEngineBinaryPath(options: {
  appPath: string
  moduleDirname: string
  resourcesPath: string
  isPackaged: boolean
  existsSync: (targetPath: string) => boolean
}): string {
  if (!options.isPackaged) {
    const devCandidates = [
      path.join(options.appPath, '..', 'devdesk-addons', 'devdesk-engine', 'dist', 'cli.js'),
      path.join(options.appPath, '..', '..', 'devdesk-addons', 'devdesk-engine', 'dist', 'cli.js'),
      path.join(options.moduleDirname, '..', '..', '..', '..', '..', 'devdesk-addons', 'devdesk-engine', 'dist', 'cli.js'),
    ]

    for (const candidate of devCandidates) {
      if (options.existsSync(candidate)) {
        return candidate
      }
    }
  }

  return path.join(options.resourcesPath, 'engine', 'cli.js')
}

export function getEngineDbPathFromUserData(userDataPath: string, projectId: string): string {
  return path.join(userDataPath, 'engine', `${projectId}.sqlite`)
}

export function buildEngineIndexArgs(projectPath: string, dbPath: string): string[] {
  return ['index', projectPath, '--db', dbPath]
}

export function buildEngineSearchArgs(
  query: string,
  dbPath: string,
  options?: {
    regex?: boolean
    limit?: number
  }
): string[] {
  const args = ['search', query, '--db', dbPath]

  if (options?.regex) {
    args.push('--regex')
  }

  if (options?.limit) {
    args.push('--limit', String(options.limit))
  }

  return args
}

export function buildEngineStatsArgs(dbPath: string): string[] {
  return ['stats', '--db', dbPath]
}
