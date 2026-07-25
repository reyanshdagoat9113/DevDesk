import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectEnginePanel } from './ProjectEnginePanel'
import type {
  EngineGitInsights,
  EngineIndexMeta,
  EngineIndexResult,
  EngineSearchResult,
  EngineSearchSession,
  EngineStats,
  EngineStatus,
  GitCommitResult,
  GitCreatePullRequestResult,
  GitPushResult,
  GitWorkflowState,
  Project,
} from '../types'

vi.mock('./GitWorkspacePanel', () => ({
  GitWorkspacePanel: () => <div data-testid="git-workspace-panel">Git workspace</div>,
}))

const project: Project = {
  id: 'project-1',
  name: 'DevDesk',
  path: '/workspace/devdesk',
  type: 'node',
  icon: 'box',
  linkedContainerNames: [],
}

const engineStatus: EngineStatus = { available: true, version: '0.1.0' }

const indexMeta: Record<string, EngineIndexMeta> = {
  'project-1': {
    projectId: 'project-1',
    dbPath: '/tmp/project-1.sqlite',
    lastIndexed: '2026-04-11T00:00:00.000Z',
    fileCount: 42,
  },
}

const latestIndexResults: Record<string, EngineIndexResult> = {
  'project-1': {
    ok: true,
    repo: '/workspace/devdesk',
    db: '/tmp/project-1.sqlite',
    filesIndexed: 42,
    filesSkipped: 3,
    durationMs: 77,
    warnings: ['Skipped vendor folder'],
  },
}

const stats: EngineStats = {
  ok: true,
  db: '/tmp/project-1.sqlite',
  stats: {
    totalFiles: 42,
    totalSizeBytes: 2048,
    byLanguage: { typescript: 30, rust: 12 },
    indexedAt: '2026-04-11T00:00:00.000Z',
  },
}

const searchResult: EngineSearchResult = {
  ok: true,
  query: 'needle',
  totalMatches: 1,
  durationMs: 8,
  results: [
    {
      path: 'src/app.ts',
      language: 'typescript',
      score: 0.91,
      matches: [
        {
          line: 12,
          column: 4,
          snippet: 'const needle = true',
          contextBefore: ['before'],
          contextAfter: ['after'],
        },
      ],
    },
  ],
}

function createProps() {
  return {
    project,
    engineStatus,
    engineIndexes: indexMeta,
    searchSessions: {} as Record<string, EngineSearchSession>,
    indexingProjects: {},
    latestIndexResults,
    onIndexProject: vi.fn(async () => undefined),
    onSearch: vi.fn(async () => searchResult),
    onLoadStats: vi.fn(async () => stats),
    onLoadGitInsights: vi.fn(async (): Promise<EngineGitInsights> => ({ branch: 'main', totalCommits: 1, contributors: [], hotspots: [], recentCommits: [], churnFiles: [], workingTree: { isClean: true, hasStagedChanges: false, hasUnstagedChanges: false, hasUntrackedChanges: false, hasConflicts: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, conflictedCount: 0, ahead: 0, behind: 0, files: [] } })),
    onLoadGitState: vi.fn(async (): Promise<GitWorkflowState> => ({ ok: true, available: true, repoPath: project.path, branch: 'main', upstream: 'origin/main', remoteName: 'origin', remoteUrl: 'https://github.com/foo/bar.git', provider: 'github', ahead: 0, behind: 0, canPush: true, canCreatePullRequest: true, workingTree: null })),
    onLoadFileDiff: vi.fn(async () => ({ ok: true, available: true, path: 'src/file.ts', sections: [] })),
    onCommitChanges: vi.fn(async (): Promise<GitCommitResult> => ({ ok: true, message: 'Committed', branch: 'main', commitHash: 'abc123' })),
    onPushBranch: vi.fn(async (): Promise<GitPushResult> => ({ ok: true, message: 'Pushed', branch: 'main', remoteName: 'origin', remoteUrl: 'https://github.com/foo/bar.git' })),
    onCreatePullRequest: vi.fn(async (): Promise<GitCreatePullRequestResult> => ({ ok: true, message: 'Opened', branch: 'main', baseBranch: 'main', isDraft: false, mode: 'manual', url: 'https://github.com/foo/bar/compare/main...main' })),
    onOpenResult: vi.fn(async () => undefined),
    onRevealResult: vi.fn(async () => undefined),
    onClearProjectIndex: vi.fn(async () => undefined),
    onClearSearchSession: vi.fn(async () => undefined),
    onOpenExternalUrl: vi.fn(async () => undefined),
    onOpenEngine: vi.fn(),
  }
}

describe('ProjectEnginePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads stats and renders index summary details', async () => {
    const props = createProps()
    render(<ProjectEnginePanel {...props} />)

    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy()
    })

    expect(props.onLoadStats).toHaveBeenCalledWith('project-1')
    expect(screen.getByText(/Warning: Skipped vendor folder/)).toBeTruthy()
    expect(screen.getByText('typescript: 30')).toBeTruthy()
    expect(screen.getByTestId('git-workspace-panel')).toBeTruthy()
  })

  it('runs searches and opens search results', async () => {
    const props = createProps()
    render(<ProjectEnginePanel {...props} />)

    const input = screen.getByPlaceholderText(/Search indexed code in DevDesk/)
    await userEvent.clear(input)
    await userEvent.type(input, 'needle')
    await userEvent.click(screen.getByRole('button', { name: /Regex Off/i }))
    await userEvent.click(screen.getByRole('button', { name: /^Search$/i }))

    await waitFor(() => {
      expect(props.onSearch).toHaveBeenCalledWith('project-1', 'needle', { regex: true, limit: 20 })
    })

    expect(screen.getByText('src/app.ts')).toBeTruthy()
    await userEvent.click(screen.getAllByRole('button', { name: 'Open' })[0])
    expect(props.onOpenResult).toHaveBeenCalledWith('project-1', 'src/app.ts', { line: 12, column: 4 })
  })

  it('shows a validation error when searching with an empty query', async () => {
    const props = createProps()
    render(<ProjectEnginePanel {...props} />)

    await userEvent.click(screen.getByRole('button', { name: /^Search$/i }))

    expect(screen.getByText('Search query is required.')).toBeTruthy()
    expect(props.onSearch).not.toHaveBeenCalled()
  })
})
