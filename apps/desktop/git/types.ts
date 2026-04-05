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

export interface GitDiffResult {
  ok: boolean
  path: string
  diff: string
  generatedForUntracked?: boolean
  message?: string
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
