import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'

const engineGit = vi.fn(async () => {
  throw new Error('fallback')
})

vi.mock('../engine/binary', () => ({
  engineGit,
}))

describe('git service', () => {
  let tempDir = ''
  let repoDir = ''
  let remoteDir = ''

  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-git-service-'))
    repoDir = path.join(tempDir, 'repo')
    remoteDir = path.join(tempDir, 'remote.git')
    fs.mkdirSync(repoDir, { recursive: true })

    runGit(['init', '-b', 'main'])
    runGit(['config', 'user.name', 'DevDesk Tests'])
    runGit(['config', 'user.email', 'devdesk-tests@example.com'])

    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const value = 1\n')
    runGit(['add', '.'])
    runGit(['commit', '-m', 'Initial commit'])

    execSync('git init --bare remote.git', { cwd: tempDir, stdio: 'ignore' })
    runGit(['remote', 'add', 'origin', remoteDir])
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function runGit(args: string[]) {
    return execSync(`git ${args.map((arg) => `"${arg}"`).join(' ')}`, { cwd: repoDir, encoding: 'utf8' }).trim()
  }

  it('reports unavailable workflow state for non-repositories', async () => {
    const { getGitWorkflowState } = await import('./service')
    const result = await getGitWorkflowState(path.join(tempDir, 'missing'))
    expect(result.available).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('falls back to git cli insights and workflow state', async () => {
    const { getGitInsights, getGitWorkflowState } = await import('./service')
    fs.writeFileSync(path.join(repoDir, 'notes.md'), '# scratch\n')

    const insights = await getGitInsights(repoDir)
    const workflow = await getGitWorkflowState(repoDir)

    expect(insights?.totalCommits).toBe(1)
    expect(insights?.workingTree.hasUntrackedChanges).toBe(true)
    expect(workflow.available).toBe(true)
    expect(workflow.branch).toBeTruthy()
    expect(workflow.canPush).toBe(true)
  })

  it('generates diffs for tracked and untracked files', async () => {
    const { getGitDiff } = await import('./service')
    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const value = 2\n')
    fs.writeFileSync(path.join(repoDir, 'notes.md'), '# scratch\n')

    const tracked = await getGitDiff(repoDir, 'src/tracked.ts')
    const untracked = await getGitDiff(repoDir, 'notes.md')

    expect(tracked.ok).toBe(true)
    expect(tracked.diff).toContain('diff --git')
    expect(untracked.ok).toBe(true)
    expect(untracked.generatedForUntracked).toBe(true)
  })

  it('commits and pushes current branch to a new upstream', async () => {
    const { commitAllChanges, pushCurrentBranch } = await import('./service')
    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const committed = true\n')

    const commit = await commitAllChanges(repoDir, 'Add tracked update')
    const push = await pushCurrentBranch(repoDir)

    expect(commit.ok).toBe(true)
    expect(commit.commitHash).toBeTruthy()
    expect(push.ok).toBe(true)
    expect(push.remoteName).toBe('origin')
  })

  it('creates a manual GitHub compare URL for pull requests', async () => {
    const { createPullRequest } = await import('./service')
    runGit(['push', '-u', 'origin', runGit(['branch', '--show-current'])])
    runGit(['remote', 'set-url', 'origin', 'https://github.com/foo/bar.git'])

    const result = await createPullRequest(repoDir, {
      title: 'Release polish',
      body: 'Ship the release work',
      isDraft: false,
    })

    expect(result.ok).toBe(true)
    expect(result.mode).toBe('manual')
    expect(result.url).toContain('https://github.com/foo/bar/compare/')
  })
})
