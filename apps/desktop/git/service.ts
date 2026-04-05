import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { engineGit } from '../engine/binary'
import type { EngineGitInsights } from '../engine/types'
import { buildCompareUrl, inferBaseBranch, parseGitRemote } from './runtime'
import type {
  GitCommitResult,
  GitCreatePullRequestInput,
  GitCreatePullRequestResult,
  GitDiffResult,
  GitPushResult,
  GitWorkflowState,
} from './types'

type CommandResult = {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
}

function cleanShellText(value: string) {
  return value.replace(/\u0000/g, '').trim()
}

async function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      resolve({
        ok: false,
        stdout,
        stderr: error.message,
        code: null,
      })
    })

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        stdout: cleanShellText(stdout),
        stderr: cleanShellText(stderr),
        code,
      })
    })
  })
}

async function runGit(repoPath: string, args: string[]) {
  const result = await runCommand('git', args, repoPath)
  if (!result.ok) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout
}

async function tryGit(repoPath: string, args: string[]) {
  return runCommand('git', args, repoPath)
}

async function isGitRepository(repoPath: string) {
  const result = await tryGit(repoPath, ['rev-parse', '--is-inside-work-tree'])
  return result.ok && result.stdout === 'true'
}

async function getRemoteHeadRef(repoPath: string, remoteName: string) {
  const result = await tryGit(repoPath, ['symbolic-ref', `refs/remotes/${remoteName}/HEAD`])
  return result.ok ? result.stdout : null
}

async function getPreferredRemoteName(repoPath: string) {
  const remotes = await tryGit(repoPath, ['remote'])
  if (!remotes.ok || !remotes.stdout) {
    return null
  }

  const remoteNames = remotes.stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
  if (remoteNames.includes('origin')) {
    return 'origin'
  }
  return remoteNames[0] ?? null
}

function buildUntrackedDiff(relativePath: string, content: string) {
  const lines = content.split(/\r?\n/)
  const body = lines.map((line) => `+${line}`).join('\n')
  return [
    `diff --git a/${relativePath} b/${relativePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${relativePath}`,
    `@@ -0,0 +1,${lines.length} @@`,
    body,
  ].join('\n')
}

async function buildUnifiedDiff(repoPath: string, relativePath: string): Promise<GitDiffResult> {
  const normalizedPath = relativePath.replace(/\\/g, '/')
  const staged = await tryGit(repoPath, ['diff', '--cached', '--', normalizedPath])
  const unstaged = await tryGit(repoPath, ['diff', '--', normalizedPath])
  const sections: string[] = []

  if (staged.ok && staged.stdout) {
    sections.push(staged.stdout)
  }

  if (unstaged.ok && unstaged.stdout) {
    sections.push(unstaged.stdout)
  }

  if (sections.length) {
    return {
      ok: true,
      path: normalizedPath,
      diff: sections.join('\n\n'),
    }
  }

  const absolutePath = path.join(repoPath, normalizedPath)
  try {
    const content = await fs.readFile(absolutePath, 'utf8')
    return {
      ok: true,
      path: normalizedPath,
      diff: buildUntrackedDiff(normalizedPath, content),
      generatedForUntracked: true,
    }
  } catch {
    return {
      ok: false,
      path: normalizedPath,
      diff: '',
      message: 'No diff is available for this file.',
    }
  }
}

async function getEngineInsights(repoPath: string): Promise<EngineGitInsights | null> {
  try {
    return await engineGit(repoPath)
  } catch {
    return null
  }
}

export async function getGitWorkflowState(repoPath: string): Promise<GitWorkflowState> {
  if (!(await isGitRepository(repoPath))) {
    return {
      ok: false,
      available: false,
      repoPath,
      branch: null,
      upstream: null,
      remoteName: null,
      remoteUrl: null,
      provider: 'unknown',
      ahead: 0,
      behind: 0,
      canPush: false,
      canCreatePullRequest: false,
      message: 'This project is not a git repository.',
      workingTree: null,
    }
  }

  const insights = await getEngineInsights(repoPath)
  const branch = insights?.branch || (await tryGit(repoPath, ['branch', '--show-current'])).stdout || null
  const upstreamResult = await tryGit(repoPath, ['rev-parse', '--abbrev-ref', '@{upstream}'])
  const upstream = upstreamResult.ok ? upstreamResult.stdout : null
  const remoteName = upstream?.split('/')[0] || (await getPreferredRemoteName(repoPath))
  const remoteUrlResult = remoteName ? await tryGit(repoPath, ['remote', 'get-url', remoteName]) : null
  const remoteUrl = remoteUrlResult?.ok ? remoteUrlResult.stdout : null
  const remote = remoteName && remoteUrl ? parseGitRemote(remoteName, remoteUrl) : null
  const ahead = insights?.workingTree?.ahead ?? 0
  const behind = insights?.workingTree?.behind ?? 0
  const hasConflicts = Boolean(insights?.workingTree?.hasConflicts)

  return {
    ok: true,
    available: true,
    repoPath,
    branch,
    upstream,
    remoteName,
    remoteUrl,
    provider: remote?.provider ?? 'unknown',
    ahead,
    behind,
    canPush: Boolean(branch && remoteName && !hasConflicts),
    canCreatePullRequest: Boolean(branch && remote?.provider === 'github' && !hasConflicts),
    workingTree: insights?.workingTree ?? null,
  }
}

export async function getGitDiff(repoPath: string, relativePath: string): Promise<GitDiffResult> {
  if (!(await isGitRepository(repoPath))) {
    return {
      ok: false,
      path: relativePath,
      diff: '',
      message: 'This project is not a git repository.',
    }
  }

  return buildUnifiedDiff(repoPath, relativePath)
}

export async function commitAllChanges(repoPath: string, message: string): Promise<GitCommitResult> {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    return {
      ok: false,
      message: 'A commit message is required.',
      branch: null,
    }
  }

  const state = await getGitWorkflowState(repoPath)
  if (!state.available || !state.ok) {
    return {
      ok: false,
      message: state.message || 'This project is not a git repository.',
      branch: null,
    }
  }

  if (state.workingTree?.hasConflicts) {
    return {
      ok: false,
      message: 'Resolve merge conflicts before committing.',
      branch: state.branch,
    }
  }

  if (state.workingTree?.isClean) {
    return {
      ok: false,
      message: 'There are no changes to commit.',
      branch: state.branch,
    }
  }

  await runGit(repoPath, ['add', '-A'])
  await runGit(repoPath, ['commit', '-m', trimmedMessage])
  const commitHash = await runGit(repoPath, ['rev-parse', 'HEAD'])

  return {
    ok: true,
    message: 'Committed all changes.',
    branch: state.branch,
    commitHash,
  }
}

export async function pushCurrentBranch(repoPath: string, setUpstreamIfNeeded: boolean = true): Promise<GitPushResult> {
  const state = await getGitWorkflowState(repoPath)
  if (!state.available || !state.ok || !state.branch) {
    return {
      ok: false,
      message: state.message || 'This project is not ready to push.',
      branch: state.branch,
      remoteName: state.remoteName,
      remoteUrl: state.remoteUrl,
    }
  }

  if (state.workingTree?.hasConflicts) {
    return {
      ok: false,
      message: 'Resolve merge conflicts before pushing.',
      branch: state.branch,
      remoteName: state.remoteName,
      remoteUrl: state.remoteUrl,
    }
  }

  const remoteName = state.remoteName || 'origin'
  const args = state.upstream
    ? ['push']
    : setUpstreamIfNeeded
      ? ['push', '-u', remoteName, state.branch]
      : ['push']

  const result = await tryGit(repoPath, args)
  if (!result.ok) {
    return {
      ok: false,
      message: result.stderr || 'Push failed.',
      branch: state.branch,
      remoteName,
      remoteUrl: state.remoteUrl,
    }
  }

  return {
    ok: true,
    message: 'Pushed current branch.',
    branch: state.branch,
    remoteName,
    remoteUrl: state.remoteUrl,
  }
}

export async function createPullRequest(
  repoPath: string,
  input: GitCreatePullRequestInput
): Promise<GitCreatePullRequestResult> {
  const state = await getGitWorkflowState(repoPath)
  if (!state.available || !state.ok || !state.branch) {
    return {
      ok: false,
      message: state.message || 'This project is not ready for a pull request.',
      branch: state.branch,
      baseBranch: input.baseBranch || null,
      isDraft: input.isDraft,
    }
  }

  if (state.provider !== 'github' || !state.remoteName || !state.remoteUrl) {
    return {
      ok: false,
      message: 'Pull request creation is only supported for GitHub remotes in this release.',
      branch: state.branch,
      baseBranch: input.baseBranch || null,
      isDraft: input.isDraft,
    }
  }

  const remote = parseGitRemote(state.remoteName, state.remoteUrl)
  if (remote.provider !== 'github' || !remote.webUrl) {
    return {
      ok: false,
      message: 'Unable to resolve the GitHub repository URL.',
      branch: state.branch,
      baseBranch: input.baseBranch || null,
      isDraft: input.isDraft,
    }
  }

  const remoteHeadRef = await getRemoteHeadRef(repoPath, state.remoteName)
  const baseBranch = input.baseBranch?.trim() || inferBaseBranch(remoteHeadRef)

  const compareUrl = buildCompareUrl({
    webUrl: remote.webUrl,
    baseBranch: baseBranch || 'main',
    headBranch: state.branch,
    title: input.title.trim(),
    body: input.body.trim(),
  })

  return {
    ok: true,
    message: input.isDraft
      ? 'Opened the GitHub pull request flow. Choose "Create draft pull request" in the browser.'
      : 'Opened the GitHub pull request flow.',
    url: compareUrl,
    mode: 'manual',
    branch: state.branch,
    baseBranch,
    isDraft: input.isDraft,
  }
}
