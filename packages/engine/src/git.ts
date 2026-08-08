import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { normalizePath, resolvePath } from './utils.js';
import type { GitInsightsOptions } from './types.js';

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface FileChurn {
  path: string;
  commits: number;
  authors: string[];
  lastModified: string;
  linesAdded: number;
  linesDeleted: number;
}

export interface HotspotFile {
  path: string;
  score: number;
  commits: number;
  recency: number; // Days since last modification
  risk: 'low' | 'medium' | 'high';
}

export interface GitChangedFile {
  path: string;
  previousPath?: string;
  indexStatus: string;
  workingTreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  conflicted: boolean;
  summary: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'conflicted' | 'unknown';
  additions: number;
  deletions: number;
}

export interface GitWorkingTree {
  isClean: boolean;
  hasStagedChanges: boolean;
  hasUnstagedChanges: boolean;
  hasUntrackedChanges: boolean;
  hasConflicts: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  ahead: number;
  behind: number;
  files: GitChangedFile[];
}

export interface GitInsights {
  branch: string;
  totalCommits: number;
  contributors: string[];
  hotspots: HotspotFile[];
  recentCommits: GitCommit[];
  churnFiles: FileChurn[];
  workingTree: GitWorkingTree;
}

export interface ResolvedGitHotspot extends HotspotFile {
  repositoryPath: string;
}

/**
 * Check if path is a git repository
 */
export function isGitRepo(repoPath: string): boolean {
  if (!fs.existsSync(repoPath)) {
    return false;
  }

  try {
    const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
      windowsHide: true,
    });
    return output.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Run a git command and return output
 */
function runGit(repoPath: string, args: string[]): string {
  try {
    const result = execFileSync('git', ['--no-pager', ...args], {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 15_000,
      windowsHide: true,
    });
    return result.trim();
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(`Git command failed: ${err.stderr || err.message || String(error)}`);
  }
}

function parseNumstat(output: string): Map<string, { additions: number; deletions: number }> {
  const stats = new Map<string, { additions: number; deletions: number }>();

  for (const line of output.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
    const [added, deleted, rawPath] = line.split('\t');
    if (!rawPath) {
      continue;
    }

    const pathValue = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() || rawPath : rawPath;
    const additions = added === '-' ? 0 : parseInt(added, 10) || 0;
    const deletions = deleted === '-' ? 0 : parseInt(deleted, 10) || 0;
    stats.set(pathValue, { additions, deletions });
  }

  return stats;
}

function mergeNumstat(
  target: Map<string, { additions: number; deletions: number }>,
  next: Map<string, { additions: number; deletions: number }>
): void {
  for (const [filePath, stat] of next.entries()) {
    const current = target.get(filePath) || { additions: 0, deletions: 0 };
    current.additions += stat.additions;
    current.deletions += stat.deletions;
    target.set(filePath, current);
  }
}

function hasStatusFlag(status: string, flags: string[]): boolean {
  return flags.includes(status);
}

function summarizeStatus(indexStatus: string, workingTreeStatus: string): GitChangedFile['summary'] {
  const combined = `${indexStatus}${workingTreeStatus}`;

  if (combined === '??') {
    return 'untracked';
  }

  if (['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(combined)) {
    return 'conflicted';
  }

  if (hasStatusFlag(indexStatus, ['R']) || hasStatusFlag(workingTreeStatus, ['R'])) {
    return 'renamed';
  }

  if (hasStatusFlag(indexStatus, ['C']) || hasStatusFlag(workingTreeStatus, ['C'])) {
    return 'copied';
  }

  if (hasStatusFlag(indexStatus, ['A']) || hasStatusFlag(workingTreeStatus, ['A'])) {
    return 'added';
  }

  if (hasStatusFlag(indexStatus, ['D']) || hasStatusFlag(workingTreeStatus, ['D'])) {
    return 'deleted';
  }

  if (hasStatusFlag(indexStatus, ['M']) || hasStatusFlag(workingTreeStatus, ['M'])) {
    return 'modified';
  }

  return 'unknown';
}

function getAheadBehind(repoPath: string): { ahead: number; behind: number } {
  try {
    const upstream = runGit(repoPath, ['rev-parse', '--abbrev-ref', '@{upstream}']);
    if (!upstream) {
      return { ahead: 0, behind: 0 };
    }

    const counts = runGit(repoPath, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`]);
    const [behindText, aheadText] = counts.split(/\s+/);
    return {
      ahead: parseInt(aheadText || '0', 10) || 0,
      behind: parseInt(behindText || '0', 10) || 0,
    };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

/**
 * Get current working tree status and changed files
 */
export function getWorkingTree(repoPath: string): GitWorkingTree {
  const output = runGit(repoPath, ['status', '--porcelain=1', '--untracked-files=all']);
  const combinedStats = new Map<string, { additions: number; deletions: number }>();
  mergeNumstat(combinedStats, parseNumstat(runGit(repoPath, ['diff', '--numstat'])));
  mergeNumstat(combinedStats, parseNumstat(runGit(repoPath, ['diff', '--cached', '--numstat'])));

  const files: GitChangedFile[] = [];
  let stagedCount = 0;
  let unstagedCount = 0;
  let untrackedCount = 0;
  let conflictedCount = 0;

  for (const line of output.split('\n').filter(Boolean)) {
    const indexStatus = line[0] || ' ';
    const workingTreeStatus = line[1] || ' ';
    const rawPath = line.slice(3).trim();

    if (!rawPath) {
      continue;
    }

    const [previousPath, nextPath] = rawPath.split(' -> ');
    const filePath = nextPath || previousPath;
    const conflicted = ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(`${indexStatus}${workingTreeStatus}`);
    const untracked = indexStatus === '?' && workingTreeStatus === '?';
    const staged = indexStatus !== ' ' && indexStatus !== '?';
    const unstaged = workingTreeStatus !== ' ' && workingTreeStatus !== '?';

    if (staged) {
      stagedCount++;
    }
    if (unstaged) {
      unstagedCount++;
    }
    if (untracked) {
      untrackedCount++;
    }
    if (conflicted) {
      conflictedCount++;
    }

    const stat = combinedStats.get(filePath) || { additions: 0, deletions: 0 };

    files.push({
      path: filePath,
      previousPath: nextPath ? previousPath : undefined,
      indexStatus,
      workingTreeStatus,
      staged,
      unstaged,
      untracked,
      conflicted,
      summary: summarizeStatus(indexStatus, workingTreeStatus),
      additions: stat.additions,
      deletions: stat.deletions,
    });
  }

  const { ahead, behind } = getAheadBehind(repoPath);

  return {
    isClean: files.length === 0,
    hasStagedChanges: stagedCount > 0,
    hasUnstagedChanges: unstagedCount > 0,
    hasUntrackedChanges: untrackedCount > 0,
    hasConflicts: conflictedCount > 0,
    stagedCount,
    unstagedCount,
    untrackedCount,
    conflictedCount,
    ahead,
    behind,
    files,
  };
}

/**
 * Get current branch name
 */
export function getCurrentBranch(repoPath: string): string {
  return runGit(repoPath, ['branch', '--show-current']);
}

/**
 * Get total commit count
 */
export function getCommitCount(repoPath: string): number {
  const output = runGit(repoPath, ['rev-list', '--count', 'HEAD']);
  return parseInt(output, 10) || 0;
}

/**
 * Get list of contributors
 */
export function getContributors(repoPath: string): string[] {
  const output = runGit(repoPath, ['log', '--format=%an <%ae>']);
  const authors = output
    .split('\n')
    .map((author) => author.trim())
    .filter(Boolean);
  return [...new Set(authors)];
}

/**
 * Get recent commits
 */
export function getRecentCommits(repoPath: string, limit: number = 10): GitCommit[] {
  const format = '__COMMIT__%n%H%n%an%n%ad%n%s';
  const output = runGit(repoPath, [
    'log',
    '--name-only',
    `--format=${format}`,
    `-n`,
    String(limit),
  ]);

  const blocks = output
    .split('__COMMIT__\n')
    .map((block) => block.trim())
    .filter(Boolean);
  const commits: GitCommit[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 4) {
      continue;
    }

    const hash = lines[0]?.trim();
    if (!hash) {
      continue;
    }

    commits.push({
      hash,
      author: lines[1] || '',
      date: lines[2] || '',
      message: lines[3] || '',
      files: lines.slice(4).map((line) => line.trim()).filter(Boolean),
    });
  }

  return commits;
}

/**
 * Get file churn (change frequency)
 */
export function getFileChurn(repoPath: string, limit: number = 20): FileChurn[] {
  const output = runGit(repoPath, [
    'log',
    '--format=__DEV_DESK_COMMIT__%x1f%an <%ae>%x1f%aI',
    '--numstat',
    '--no-renames',
  ]);
  const byPath = new Map<string, FileChurn & { authorSet: Set<string> }>();
  let currentAuthor = '';
  let currentDate = '';

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('__DEV_DESK_COMMIT__')) {
      const [, author = '', date = ''] = line.split('\u001f');
      currentAuthor = author;
      currentDate = date;
      continue;
    }

    const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!match) continue;

    const [, additions, deletions, filePath] = match;
    const existing = byPath.get(filePath) ?? {
      path: filePath,
      commits: 0,
      authors: [],
      authorSet: new Set<string>(),
      lastModified: '',
      linesAdded: 0,
      linesDeleted: 0,
    };

    existing.commits += 1;
    existing.linesAdded += Number.parseInt(additions, 10) || 0;
    existing.linesDeleted += Number.parseInt(deletions, 10) || 0;
    if (currentAuthor) existing.authorSet.add(currentAuthor);
    // git log is newest-first, so the first date seen is the latest one.
    if (!existing.lastModified) existing.lastModified = currentDate;
    byPath.set(filePath, existing);
  }

  const churnData = [...byPath.values()].map(({ authorSet, ...entry }) => ({
    ...entry,
    authors: [...authorSet],
  }));
  churnData.sort((a, b) => b.commits - a.commits);
  return churnData.slice(0, limit);
}

/**
 * Calculate hotspot score
 */
function calculateHotspotScore(commits: number, recencyDays: number): number {
  // More commits = higher score
  // More recent = higher score
  const commitScore = Math.min(commits / 10, 1) * 50; // Max 50 points for commits
  const recencyScore = Math.max(0, (365 - recencyDays) / 365) * 50; // Max 50 points for recency

  return commitScore + recencyScore;
}

/**
 * Determine risk level based on score
 */
function determineRisk(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Get hotspot files (most changed, potential risk areas)
 */
export function getHotspots(repoPath: string, limit: number = 10): HotspotFile[] {
  const churn = getFileChurn(repoPath, limit * 2);

  return buildHotspots(churn, limit);
}

function buildHotspots(churn: FileChurn[], limit: number): HotspotFile[] {

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const hotspots: HotspotFile[] = churn.map((file) => {
    // Parse last modified date
    let recencyDays = 365; // Default to 1 year
    if (file.lastModified) {
      const lastModDate = new Date(file.lastModified);
      recencyDays = Math.floor((now - lastModDate.getTime()) / dayMs);
    }

    const score = calculateHotspotScore(file.commits, recencyDays);
    const risk = determineRisk(score);

    return {
      path: file.path,
      score,
      commits: file.commits,
      recency: recencyDays,
      risk,
    };
  });

  // Sort by score descending
  hotspots.sort((a, b) => b.score - a.score);
  return hotspots.slice(0, limit);
}

/**
 * Resolve hotspot paths relative to a repository root.
 */
export function resolveHotspots(repoPath: string, hotspots: HotspotFile[]): ResolvedGitHotspot[] {
  const repoRoot = resolvePath(repoPath);

  return hotspots.map((hotspot) => ({
    ...hotspot,
    repositoryPath: normalizePath(repoRoot),
    path: normalizePath(path.resolve(repoRoot, hotspot.path)),
  }));
}

/**
 * Get comprehensive git insights
 */
export function getGitInsights(repoPath: string, options: GitInsightsOptions = {}): GitInsights {
  if (!isGitRepo(repoPath)) {
    throw new Error('Not a git repository');
  }

  const limit = options.limit ?? 10;
  const churn = getFileChurn(repoPath, limit * 2);

  return {
    branch: getCurrentBranch(repoPath),
    totalCommits: getCommitCount(repoPath),
    contributors: getContributors(repoPath),
    hotspots: buildHotspots(churn, limit),
    recentCommits: getRecentCommits(repoPath, limit),
    churnFiles: churn.slice(0, limit),
    workingTree: getWorkingTree(repoPath),
  };
}
