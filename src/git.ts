import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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

export interface GitInsights {
  branch: string;
  totalCommits: number;
  contributors: string[];
  hotspots: HotspotFile[];
  recentCommits: GitCommit[];
  churnFiles: FileChurn[];
}

/**
 * Check if path is a git repository
 */
export function isGitRepo(repoPath: string): boolean {
  const gitDir = path.join(repoPath, '.git');
  return fs.existsSync(gitDir);
}

/**
 * Run a git command and return output
 */
function runGit(repoPath: string, args: string[]): string {
  try {
    const command = `git ${args.map((a) => `"${a}"`).join(' ')}`;
    const result = execSync(command, {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return result.trim();
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(`Git command failed: ${err.stderr || err.message || String(error)}`);
  }
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
  const output = runGit(repoPath, ['shortlog', '-sne', '--format=%ae']);
  const authors = output.split('\n').filter(Boolean);
  return [...new Set(authors)]; // Unique
}

/**
 * Get recent commits
 */
export function getRecentCommits(repoPath: string, limit: number = 10): GitCommit[] {
  const format = '%H%n%an%n%ad%n%s%n';
  const output = runGit(repoPath, [
    'log',
    `--format=${format}`,
    `-n`,
    String(limit),
  ]);

  const lines = output.split('\n');
  const commits: GitCommit[] = [];

  for (let i = 0; i < lines.length; i += 5) {
    if (i + 4 >= lines.length) break;

    const hash = lines[i];
    if (!hash) continue;

    commits.push({
      hash,
      author: lines[i + 1] || '',
      date: lines[i + 2] || '',
      message: lines[i + 3] || '',
      files: (lines[i + 4] || '').split(' ').filter(Boolean),
    });
  }

  return commits;
}

/**
 * Get file churn (change frequency)
 */
export function getFileChurn(repoPath: string, limit: number = 20): FileChurn[] {
  // Get files with most changes
  const output = runGit(repoPath, [
    'log',
    '--pretty=format:',
    '--name-only',
  ]);

  // Count occurrences
  const fileCounts = new Map<string, { count: number; authors: Set<string> }>();

  const lines = output.split('\n').filter(Boolean);
  for (const file of lines) {
    if (!fileCounts.has(file)) {
      fileCounts.set(file, { count: 0, authors: new Set() });
    }
    const data = fileCounts.get(file)!;
    data.count++;
  }

  // Get author info for each file
  const churnData: FileChurn[] = [];

  for (const [filePath, data] of fileCounts.entries()) {
    if (data.count < 1) continue;

    // Get last modified date
    let lastModified = '';
    try {
      lastModified = runGit(repoPath, [
        'log',
        '-1',
        '--format=%ad',
        '--',
        filePath,
      ]);
    } catch {
      // File might not exist anymore
    }

    // Get line changes
    let linesAdded = 0;
    let linesDeleted = 0;
    try {
      const stats = runGit(repoPath, [
        'log',
        '--numstat',
        '--format=',
        '--',
        filePath,
      ]);
      const statLines = stats.split('\n').filter(Boolean);
      for (const stat of statLines) {
        const [added, deleted] = stat.split('\t');
        linesAdded += parseInt(added, 10) || 0;
        linesDeleted += parseInt(deleted, 10) || 0;
      }
    } catch {
      // Ignore errors
    }

    churnData.push({
      path: filePath,
      commits: data.count,
      authors: [...data.authors],
      lastModified,
      linesAdded,
      linesDeleted,
    });
  }

  // Sort by commit count
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
 * Get comprehensive git insights
 */
export function getGitInsights(repoPath: string): GitInsights {
  if (!isGitRepo(repoPath)) {
    throw new Error('Not a git repository');
  }

  return {
    branch: getCurrentBranch(repoPath),
    totalCommits: getCommitCount(repoPath),
    contributors: getContributors(repoPath),
    hotspots: getHotspots(repoPath, 10),
    recentCommits: getRecentCommits(repoPath, 10),
    churnFiles: getFileChurn(repoPath, 20),
  };
}
