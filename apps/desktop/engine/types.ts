export interface EngineIndexResult {
  ok: boolean
  repo: string
  db: string
  filesIndexed: number
  filesSkipped: number
  durationMs: number
  warnings: string[]
}

export interface EngineSearchMatch {
  line: number
  column: number
  snippet: string
  contextBefore: string[]
  contextAfter: string[]
}

export interface EngineSearchFileResult {
  path: string
  language: string | null
  score: number
  matches: EngineSearchMatch[]
}

export interface EngineSearchResult {
  ok: boolean
  query: string
  results: EngineSearchFileResult[]
  totalMatches: number
  durationMs: number
}

export interface EngineStats {
  ok: boolean
  db: string
  stats: {
    totalFiles: number
    totalSizeBytes: number
    byLanguage: Record<string, number>
    indexedAt: string
  }
}

export interface EngineGitInsights {
  branch: string
  totalCommits: number
  contributors: string[]
  hotspots: Array<{
    path: string
    score: number
    commits: number
    recency: number
    risk: 'low' | 'medium' | 'high'
  }>
  recentCommits: Array<{
    hash: string
    author: string
    date: string
    message: string
    files: string[]
  }>
  churnFiles: Array<{
    path: string
    commits: number
    authors: string[]
    lastModified: string
    linesAdded: number
    linesDeleted: number
  }>
  workingTree: {
    isClean: boolean
    hasStagedChanges: boolean
    hasUnstagedChanges: boolean
    hasUntrackedChanges: boolean
    hasConflicts: boolean
    stagedCount: number
    unstagedCount: number
    untrackedCount: number
    conflictedCount: number
    ahead: number
    behind: number
    files: Array<{
      path: string
      previousPath?: string
      indexStatus: string
      workingTreeStatus: string
      staged: boolean
      unstaged: boolean
      untracked: boolean
      conflicted: boolean
      summary: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'conflicted' | 'unknown'
      additions: number
      deletions: number
    }>
  }
}

export interface EngineStatus {
  available: boolean
  version?: string
  error?: string
}
