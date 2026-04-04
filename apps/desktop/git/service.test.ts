import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  commitAllChanges,
  createPullRequest,
  getGitDiff,
  getGitWorkflowState,
  pushCurrentBranch,
} from './service'

const execFileAsync = promisify(execFile)

async function git(cwd: string, args: string[]) {
  const result = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    encoding: 'utf8',
  })
  return result.stdout.trim()
}

async function createTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

async function initRepo(repoPath: string) {
  await git(repoPath, ['init', '-b', 'main'])
  await git(repoPath, ['config', 'user.name', 'DevDesk Test'])
  await git(repoPath, ['config', 'user.email', 'devdesk@example.com'])
}

async function writeFile(repoPath: string, relativePath: string, content: string) {
  const targetPath = path.join(repoPath, relativePath)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, content, 'utf8')
}

test('getGitWorkflowState reports unavailable for non-repositories', async () => {
  const tempDir = await createTempDir('devdesk-git-state-')

  const state = await getGitWorkflowState(tempDir)

  assert.equal(state.available, false)
  assert.equal(state.ok, false)
})

test('getGitDiff returns a unified diff for tracked changes', async () => {
  const repoPath = await createTempDir('devdesk-git-diff-')
  await initRepo(repoPath)
  await writeFile(repoPath, 'notes.txt', 'hello\n')
  await git(repoPath, ['add', 'notes.txt'])
  await git(repoPath, ['commit', '-m', 'Initial commit'])
  await writeFile(repoPath, 'notes.txt', 'hello\nworld\n')

  const diff = await getGitDiff(repoPath, 'notes.txt')

  assert.equal(diff.ok, true)
  assert.match(diff.diff, /diff --git a\/notes.txt b\/notes.txt/)
  assert.match(diff.diff, /\+world/)
})

test('commitAllChanges creates a commit for pending changes', async () => {
  const repoPath = await createTempDir('devdesk-git-commit-')
  await initRepo(repoPath)
  await writeFile(repoPath, 'app.txt', 'v1\n')
  await git(repoPath, ['add', 'app.txt'])
  await git(repoPath, ['commit', '-m', 'Initial commit'])
  await writeFile(repoPath, 'app.txt', 'v2\n')
  await writeFile(repoPath, 'new.txt', 'new file\n')

  const result = await commitAllChanges(repoPath, 'Update workspace state')
  const lastMessage = await git(repoPath, ['log', '-1', '--pretty=%s'])

  assert.equal(result.ok, true)
  assert.equal(lastMessage, 'Update workspace state')
})

test('pushCurrentBranch configures upstream on first push', async () => {
  const remotePath = await createTempDir('devdesk-git-remote-')
  await git(remotePath, ['init', '--bare'])

  const repoPath = await createTempDir('devdesk-git-push-')
  await initRepo(repoPath)
  await git(repoPath, ['remote', 'add', 'origin', remotePath])
  await writeFile(repoPath, 'readme.md', '# DevDesk\n')
  await git(repoPath, ['add', 'readme.md'])
  await git(repoPath, ['commit', '-m', 'Initial commit'])

  const result = await pushCurrentBranch(repoPath)
  const upstream = await git(repoPath, ['rev-parse', '--abbrev-ref', '@{upstream}'])

  assert.equal(result.ok, true)
  assert.equal(upstream, 'origin/main')
})

test('createPullRequest builds a GitHub compare URL for browser flow', async () => {
  const repoPath = await createTempDir('devdesk-git-pr-')
  await initRepo(repoPath)
  await git(repoPath, ['checkout', '-b', 'feature/git-workspace'])
  await git(repoPath, ['remote', 'add', 'origin', 'https://github.com/acme/devdesk.git'])

  const result = await createPullRequest(repoPath, {
    title: 'Add git workspace',
    body: 'Includes commit and push support.',
    isDraft: true,
  })

  assert.equal(result.ok, true)
  assert.equal(result.mode, 'manual')
  assert.match(result.url ?? '', /github\.com\/acme\/devdesk\/compare\/main\.\.\.feature%2Fgit-workspace/)
})
