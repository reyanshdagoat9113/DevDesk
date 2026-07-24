import type { EngineGitInsights } from '../engine/types'

export type GitProvider = 'github' | 'unknown'

export interface GitWorkflowState {
  ok: boolean
  available: boolean
  repoPath: string
  branch: string | null
  upstream: string | null
  remoteName: string | null
  remoteUrl: string | null
  provider: GitProvider
  ahead: number
  behind: number
  canPush: boolean
  canCreatePullRequest: boolean
  message?: string
  workingTree: EngineGitInsights['workingTree'] | null
}

export interface GitCommitResult {
  ok: boolean
  message: string
  branch: string | null
  commitHash?: string
}

export interface GitPushResult {
  ok: boolean
  message: string
  branch: string | null
  remoteName: string | null
  remoteUrl: string | null
}

export interface GitCreatePullRequestInput {
  title: string
  body: string
  isDraft: boolean
  baseBranch?: string
}

export interface GitCreatePullRequestResult {
  ok: boolean
  message: string
  url?: string
  mode?: 'created' | 'manual'
  branch: string | null
  baseBranch: string | null
  isDraft: boolean
}

export type GitDiffScope = 'staged' | 'unstaged' | 'untracked'

export type GitDiffLineKind = 'meta' | 'hunk' | 'context' | 'add' | 'del'

export interface GitDiffLine {
  kind: GitDiffLineKind
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface GitDiffSection {
  scope: GitDiffScope
  label: string
  binary: boolean
  truncated: boolean
  additions: number
  deletions: number
  lines: GitDiffLine[]
}

export interface GitFileDiffResult {
  ok: boolean
  available: boolean
  path: string
  previousPath?: string
  message?: string
  sections: GitDiffSection[]
}
