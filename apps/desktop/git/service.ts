import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { engineGit } from '../engine/binary'
import type { EngineGitInsights } from '../engine/types'
import { buildCompareUrl, inferBaseBranch, parseGitRemote } from './runtime'
import type {
  GitCommitResult,
  GitCreatePullRequestInput,
  GitCreatePullRequestResult,
  GitDiffLine,
  GitDiffScope,
  GitDiffSection,
  GitFileDiffResult,
  GitPushResult,
  GitWorkflowState,
} from './types'

const MAX_DIFF_BYTES = 250_000
const MAX_DIFF_LINES = 5_000

type CommandResult = {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
}

type GitRepositoryCheck = {
  available: boolean
  message?: string
}

function resolveGitCommandCandidates() {
  const candidates = ['git']

  if (process.platform === 'win32') {
    const programFiles = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LocalAppData ? path.win32.join(process.env.LocalAppData, 'Programs') : null,
    ].filter(Boolean) as string[]

    for (const root of programFiles) {
      candidates.push(path.win32.join(root, 'Git', 'cmd', 'git.exe'))
      candidates.push(path.win32.join(root, 'Git', 'bin', 'git.exe'))
    }
  }

  return [...new Set(candidates)]
}

function cleanShellText(value: string) {
  return value.replace(/\u0000/g, '').trim()
}

async function runCommand(command: string, args: string[], cwd: string, preserveOutput = false): Promise<CommandResult> {
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
        stdout: preserveOutput ? stdout : cleanShellText(stdout),
        stderr: preserveOutput ? stderr : cleanShellText(stderr),
        code,
      })
    })
  })
}

async function runGitCommand(args: string[], cwd: string, preserveOutput = false): Promise<CommandResult> {
  let gitNotFound: CommandResult | null = null

  for (const command of resolveGitCommandCandidates()) {
    if (command !== 'git' && !fsSync.existsSync(command)) {
      continue
    }

    const result = await runCommand(command, args, cwd, preserveOutput)
    const isMissingGit = result.code === null && /ENOENT/i.test(result.stderr)
    if (!isMissingGit) {
      return result
    }
    gitNotFound = result
  }

  return gitNotFound ?? {
    ok: false,
    stdout: '',
    stderr: 'Git executable was not found.',
    code: null,
  }
}

async function runGit(repoPath: string, args: string[]) {
  const result = await runGitCommand(args, repoPath)
  if (!result.ok) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout
}

async function tryGit(repoPath: string, args: string[], preserveOutput = false) {
  return runGitCommand(args, repoPath, preserveOutput)
}

async function checkGitRepository(repoPath: string): Promise<GitRepositoryCheck> {
  try {
    const stat = await fs.stat(repoPath)
    if (!stat.isDirectory()) {
      return {
        available: false,
        message: 'The saved project path is not a directory.',
      }
    }
  } catch (error) {
    return {
      available: false,
      message: error instanceof Error ? `The saved project path cannot be opened: ${error.message}` : 'The saved project path cannot be opened.',
    }
  }

  const result = await tryGit(repoPath, ['rev-parse', '--is-inside-work-tree'])
  if (result.ok && result.stdout === 'true') {
    return { available: true }
  }

  if (result.code === null) {
    return {
      available: false,
      message: result.stderr || 'Git could not be launched from DevDesk.',
    }
  }

  return {
    available: false,
    message: result.stderr || 'This project is not a git repository.',
  }
}

function parseBranchStatus(statusLine: string) {
  const details = statusLine.replace(/^##\s*/, '').trim()
  const [branchPart, trackingPart] = details.split(' [', 2)
  const branchName = branchPart.split('...')[0]?.trim() || null
  const tracking = trackingPart?.replace(/\]$/, '') ?? ''
  const aheadMatch = tracking.match(/ahead\s+(\d+)/)
  const behindMatch = tracking.match(/behind\s+(\d+)/)

  return {
    branch: branchName && branchName !== 'HEAD (no branch)' ? branchName : null,
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0,
  }
}

function isConflictStatus(indexStatus: string, workingTreeStatus: string) {
  const pair = `${indexStatus}${workingTreeStatus}`
  return ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(pair)
}

function summarizeFileStatus(indexStatus: string, workingTreeStatus: string): EngineGitInsights['workingTree']['files'][number]['summary'] {
  if (isConflictStatus(indexStatus, workingTreeStatus)) {
    return 'conflicted'
  }
  if (indexStatus === '?' && workingTreeStatus === '?') {
    return 'untracked'
  }
  if (indexStatus === 'R' || workingTreeStatus === 'R') {
    return 'renamed'
  }
  if (indexStatus === 'A' || workingTreeStatus === 'A') {
    return 'added'
  }
  if (indexStatus === 'D' || workingTreeStatus === 'D') {
    return 'deleted'
  }
  if (indexStatus === 'C' || workingTreeStatus === 'C') {
    return 'copied'
  }
  if (indexStatus === 'M' || workingTreeStatus === 'M') {
    return 'modified'
  }
  return 'unknown'
}

type PorcelainStatusEntry = {
  indexStatus: string
  workingTreeStatus: string
  path: string
  previousPath?: string
}

function parsePorcelainStatus(output: string): PorcelainStatusEntry[] {
  const records = output.split('\u0000')
  const entries: PorcelainStatusEntry[] = []

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (!record || record.length < 3) {
      continue
    }

    const indexStatus = record[0] ?? ' '
    const workingTreeStatus = record[1] ?? ' '
    const pathValue = record.slice(3)
    const hasSourcePath = indexStatus === 'R' ||
      indexStatus === 'C' ||
      workingTreeStatus === 'R' ||
      workingTreeStatus === 'C'
    const previousPath = hasSourcePath ? records[index + 1] || undefined : undefined

    if (hasSourcePath) {
      index += 1
    }

    entries.push({
      indexStatus,
      workingTreeStatus,
      path: pathValue,
      previousPath,
    })
  }

  return entries
}

async function getFallbackGitInsights(repoPath: string): Promise<EngineGitInsights | null> {
  if (!(await isGitRepository(repoPath))) {
    return null
  }

  const branchOutput = await runGit(repoPath, ['status', '--porcelain=1', '--branch', '--untracked-files=no'])
  const branchInfo = parseBranchStatus(branchOutput.split(/\r?\n/)[0] ?? '')
  const statusResult = await tryGit(repoPath, ['status', '--porcelain=1', '-z', '--untracked-files=all'], true)
  if (!statusResult.ok) {
    throw new Error(statusResult.stderr || 'Unable to read git status.')
  }
  const statusEntries = parsePorcelainStatus(statusResult.stdout)
  const files: EngineGitInsights['workingTree']['files'] = []

  for (const entry of statusEntries) {
    const { indexStatus, workingTreeStatus } = entry
    const summary = summarizeFileStatus(indexStatus, workingTreeStatus)
    const conflicted = isConflictStatus(indexStatus, workingTreeStatus)

    files.push({
      path: entry.path,
      previousPath: entry.previousPath,
      indexStatus,
      workingTreeStatus,
      staged: indexStatus !== ' ' && indexStatus !== '?',
      unstaged: workingTreeStatus !== ' ' && workingTreeStatus !== '?',
      untracked: indexStatus === '?' && workingTreeStatus === '?',
      conflicted,
      summary,
      additions: 0,
      deletions: 0,
    })
  }

  const recentLog = await runGit(repoPath, ['log', '--date=iso-strict', '--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1e', '-n', '10'])
  const recentCommits = recentLog
    .split('\u001e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash = '', author = '', date = '', message = ''] = entry.split('\u001f')
      return {
        hash,
        author,
        date,
        message,
        files: [],
      }
    })

  const totalCommitsOutput = await runGit(repoPath, ['rev-list', '--count', 'HEAD']).catch(() => '0')
  const contributorsOutput = await runGit(repoPath, ['shortlog', '-sn', '--all']).catch(() => '')
  const contributors = contributorsOutput
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+\s+/, ''))
    .filter(Boolean)

  const stagedCount = files.filter((file) => file.staged).length
  const unstagedCount = files.filter((file) => file.unstaged).length
  const untrackedCount = files.filter((file) => file.untracked).length
  const conflictedCount = files.filter((file) => file.conflicted).length

  return {
    branch: branchInfo.branch ?? '',
    totalCommits: Number.parseInt(totalCommitsOutput, 10) || 0,
    contributors,
    hotspots: [],
    recentCommits,
    churnFiles: [],
    workingTree: {
      isClean: files.length === 0,
      hasStagedChanges: stagedCount > 0,
      hasUnstagedChanges: unstagedCount > 0,
      hasUntrackedChanges: untrackedCount > 0,
      hasConflicts: conflictedCount > 0,
      stagedCount,
      unstagedCount,
      untrackedCount,
      conflictedCount,
      ahead: branchInfo.ahead,
      behind: branchInfo.behind,
      files,
    },
  }
}

async function isGitRepository(repoPath: string) {
  return (await checkGitRepository(repoPath)).available
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

async function getEngineInsights(repoPath: string): Promise<EngineGitInsights | null> {
  try {
    return await engineGit(repoPath)
  } catch {
    return null
  }
}

export async function getGitInsights(repoPath: string): Promise<EngineGitInsights | null> {
  const engineInsights = await getEngineInsights(repoPath)
  if (engineInsights) {
    return engineInsights
  }

  try {
    return await getFallbackGitInsights(repoPath)
  } catch {
    return null
  }
}

export async function getGitWorkflowState(repoPath: string): Promise<GitWorkflowState> {
  const repositoryCheck = await checkGitRepository(repoPath)
  if (!repositoryCheck.available) {
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
      message: repositoryCheck.message || 'This project is not a git repository.',
      workingTree: null,
    }
  }

  const insights = await getGitInsights(repoPath)
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

function normalizeRepoRelativePath(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\/+/, '')
  if (!normalized || normalized.includes('\u0000') || path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error('A valid repository-relative file path is required.')
  }
  return normalized
}

function isBinaryBuffer(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8_192))
  return sample.includes(0)
}

function countDiffStats(patch: string) {
  let additions = 0
  let deletions = 0

  for (const line of patch.split(/\r?\n/)) {
    if (!line || line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@')) {
      continue
    }
    if (line.startsWith('+')) {
      additions += 1
    } else if (line.startsWith('-')) {
      deletions += 1
    }
  }

  return { additions, deletions }
}

function isBinaryPatch(patch: string) {
  return /Binary files .* differ/i.test(patch) || /^GIT binary patch$/m.test(patch)
}

function truncateUtf8(value: string, maxBytes: number) {
  const buffer = Buffer.from(value, 'utf8')
  if (buffer.length <= maxBytes) {
    return value
  }

  let end = maxBytes
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) {
    end -= 1
  }
  return buffer.subarray(0, end).toString('utf8')
}

function parseUnifiedDiff(patch: string, truncated: boolean): GitDiffLine[] {
  const lines: GitDiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const rawLine of patch.split(/\r?\n/)) {
    if (!rawLine && lines.length === 0) {
      continue
    }

    if (
      rawLine.startsWith('diff ') ||
      rawLine.startsWith('index ') ||
      rawLine.startsWith('new file mode') ||
      rawLine.startsWith('deleted file mode') ||
      rawLine.startsWith('old mode') ||
      rawLine.startsWith('new mode') ||
      rawLine.startsWith('similarity index') ||
      rawLine.startsWith('rename from') ||
      rawLine.startsWith('rename to') ||
      rawLine.startsWith('copy from') ||
      rawLine.startsWith('copy to') ||
      rawLine.startsWith('--- ') ||
      rawLine.startsWith('+++ ')
    ) {
      lines.push({ kind: 'meta', text: rawLine })
      continue
    }

    const hunkMatch = rawLine.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s@@(.*)$/)
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1])
      newLine = Number(hunkMatch[2])
      lines.push({ kind: 'hunk', text: rawLine })
      continue
    }

    if (rawLine.startsWith('+')) {
      lines.push({
        kind: 'add',
        text: rawLine.slice(1),
        newLineNumber: newLine,
      })
      newLine += 1
      continue
    }

    if (rawLine.startsWith('-')) {
      lines.push({
        kind: 'del',
        text: rawLine.slice(1),
        oldLineNumber: oldLine,
      })
      oldLine += 1
      continue
    }

    if (rawLine.startsWith(' ') || rawLine === '') {
      lines.push({
        kind: 'context',
        text: rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine,
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      })
      oldLine += 1
      newLine += 1
      continue
    }

    if (rawLine.startsWith('\\')) {
      lines.push({ kind: 'meta', text: rawLine })
      continue
    }

    lines.push({ kind: 'meta', text: rawLine })
  }

  if (truncated) {
    lines.push({ kind: 'meta', text: '… diff truncated' })
  }

  return lines
}

function buildDiffSection(scope: GitDiffScope, label: string, patch: string): GitDiffSection {
  const binary = isBinaryPatch(patch)
  let workingPatch = patch
  let truncated = false

  if (Buffer.byteLength(workingPatch, 'utf8') > MAX_DIFF_BYTES) {
    workingPatch = truncateUtf8(workingPatch, MAX_DIFF_BYTES)
    truncated = true
  }

  const lineCount = workingPatch ? workingPatch.split(/\r?\n/).length : 0
  if (lineCount > MAX_DIFF_LINES) {
    workingPatch = workingPatch.split(/\r?\n/).slice(0, MAX_DIFF_LINES).join('\n')
    truncated = true
  }

  const stats = binary ? { additions: 0, deletions: 0 } : countDiffStats(workingPatch)

  return {
    scope,
    label,
    binary,
    truncated,
    additions: stats.additions,
    deletions: stats.deletions,
    lines: binary
      ? [{ kind: 'meta', text: 'Binary file differs.' }]
      : parseUnifiedDiff(workingPatch, truncated),
  }
}

async function runGitDiff(repoPath: string, args: string[]) {
  const result = await tryGit(repoPath, args)
  // git diff exits 1 when differences exist
  if (result.ok || result.code === 1) {
    return {
      ok: true as const,
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }

  return {
    ok: false as const,
    stdout: result.stdout,
    stderr: result.stderr || `git ${args.join(' ')} failed`,
  }
}

async function buildUntrackedDiffSection(repoPath: string, relativePath: string): Promise<GitDiffSection> {
  const absolutePath = path.join(repoPath, relativePath)

  let buffer: Buffer
  let fileMode = '100644'
  try {
    const stat = await fs.lstat(absolutePath)
    if (stat.isDirectory()) {
      throw new Error('Cannot display a diff for a directory.')
    }
    if (stat.isSymbolicLink()) {
      buffer = Buffer.from(await fs.readlink(absolutePath))
      fileMode = '120000'
    } else {
      buffer = await fs.readFile(absolutePath)
      fileMode = stat.mode & 0o111 ? '100755' : '100644'
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to read untracked file.')
  }

  if (isBinaryBuffer(buffer)) {
    return {
      scope: 'untracked',
      label: 'Untracked',
      binary: true,
      truncated: false,
      additions: 0,
      deletions: 0,
      lines: [{ kind: 'meta', text: 'Binary file differs.' }],
    }
  }

  let text = buffer.toString('utf8')
  let truncated = false
  if (Buffer.byteLength(text, 'utf8') > MAX_DIFF_BYTES) {
    text = truncateUtf8(text, MAX_DIFF_BYTES)
    truncated = true
  }

  const contentLines = text.split(/\r?\n/)
  if (contentLines.at(-1) === '') {
    contentLines.pop()
  }
  if (contentLines.length > MAX_DIFF_LINES) {
    contentLines.length = MAX_DIFF_LINES
    truncated = true
  }

  const body = contentLines.map((line) => `+${line}`).join('\n')
  const patch = [
    `diff --git a/${relativePath} b/${relativePath}`,
    `new file mode ${fileMode}`,
    '--- /dev/null',
    `+++ b/${relativePath}`,
    `@@ -0,0 +1,${contentLines.length} @@`,
    body,
  ].join('\n')

  const section = buildDiffSection('untracked', 'Untracked', patch)
  return truncated ? { ...section, truncated: true } : section
}

export async function getFileDiff(repoPath: string, filePath: string): Promise<GitFileDiffResult> {
  let relativePath: string
  try {
    relativePath = normalizeRepoRelativePath(filePath)
  } catch (error) {
    return {
      ok: false,
      available: false,
      path: filePath,
      message: error instanceof Error ? error.message : 'Invalid file path.',
      sections: [],
    }
  }

  const repositoryCheck = await checkGitRepository(repoPath)
  if (!repositoryCheck.available) {
    return {
      ok: false,
      available: false,
      path: relativePath,
      message: repositoryCheck.message || 'This project is not a git repository.',
      sections: [],
    }
  }

  const statusResult = await tryGit(
    repoPath,
    ['status', '--porcelain=1', '-z', '--untracked-files=all'],
    true,
  )
  if (!statusResult.ok) {
    return {
      ok: false,
      available: true,
      path: relativePath,
      message: statusResult.stderr || 'Unable to read git status for this file.',
      sections: [],
    }
  }

  const statusEntry = parsePorcelainStatus(statusResult.stdout).find(
    (entry) => entry.path === relativePath || entry.previousPath === relativePath,
  )
  if (!statusEntry) {
    return {
      ok: true,
      available: true,
      path: relativePath,
      message: 'No pending changes for this file.',
      sections: [],
    }
  }

  const { indexStatus, workingTreeStatus } = statusEntry
  const targetPath = statusEntry.path
  const sourcePath = statusEntry.previousPath
  const untracked = indexStatus === '?' && workingTreeStatus === '?'
  const staged = indexStatus !== ' ' && indexStatus !== '?'
  const unstaged = workingTreeStatus !== ' ' && workingTreeStatus !== '?'

  const sections: GitDiffSection[] = []

  try {
    if (untracked) {
      sections.push(await buildUntrackedDiffSection(repoPath, targetPath))
    } else {
      if (staged) {
        const stagedPaths = sourcePath && sourcePath !== targetPath
          ? [sourcePath, targetPath]
          : [targetPath]
        const stagedDiff = await runGitDiff(repoPath, ['diff', '--cached', '--', ...stagedPaths])
        if (!stagedDiff.ok) {
          return {
            ok: false,
            available: true,
            path: targetPath,
            previousPath: sourcePath,
            message: stagedDiff.stderr,
            sections: [],
          }
        }
        if (stagedDiff.stdout.trim()) {
          sections.push(buildDiffSection('staged', 'Staged', stagedDiff.stdout))
        }
      }

      if (unstaged) {
        const unstagedDiff = await runGitDiff(repoPath, ['diff', '--', targetPath])
        if (!unstagedDiff.ok) {
          return {
            ok: false,
            available: true,
            path: targetPath,
            previousPath: sourcePath,
            message: unstagedDiff.stderr,
            sections: [],
          }
        }
        if (unstagedDiff.stdout.trim()) {
          sections.push(buildDiffSection('unstaged', 'Unstaged', unstagedDiff.stdout))
        } else if (workingTreeStatus === 'D') {
          sections.push(buildDiffSection(
            'unstaged',
            'Unstaged',
            `diff --git a/${targetPath} b/${targetPath}\ndeleted file mode 100644\n--- a/${targetPath}\n+++ /dev/null\n`
          ))
        }
      }
    }
  } catch (error) {
    return {
      ok: false,
      available: true,
      path: targetPath,
      previousPath: sourcePath,
      message: error instanceof Error ? error.message : 'Failed to produce file diff.',
      sections: [],
    }
  }

  if (!sections.length) {
    return {
      ok: true,
      available: true,
      path: targetPath,
      previousPath: sourcePath,
      message: 'No textual diff is available for this file.',
      sections: [],
    }
  }

  return {
    ok: true,
    available: true,
    path: targetPath,
    previousPath: sourcePath,
    sections,
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
