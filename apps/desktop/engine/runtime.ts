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
      path.join(options.appPath, 'node_modules', 'devdesk-engine', 'dist', 'cli.js'),
      path.join(options.appPath, 'packages', 'engine', 'dist', 'cli.js'),
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

export function buildEngineIndexArgs(
  projectPath: string,
  dbPath: string,
  options?: {
    profile?: 'source-first' | 'source-docs' | 'full-text'
    full?: boolean
  },
): string[] {
  const args = ['index', projectPath, '--db', dbPath]
  const profile = options?.profile ?? 'source-first'
  args.push('--profile', profile)
  // App-driven reindex is full so profile scope changes always apply cleanly.
  if (options?.full !== false) {
    args.push('--full')
  }
  return args
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

export function buildEngineGitArgs(projectPath: string): string[] {
  return ['git', projectPath]
}
