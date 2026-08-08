import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  getCommitCount,
  getContributors,
  getCurrentBranch,
  getFileChurn,
  getGitInsights,
  getHotspots,
  getRecentCommits,
  getWorkingTree,
  isGitRepo,
  resolveHotspots,
} from './git.js';

describe('git insights', () => {
  let tempDir = '';
  let repoDir = '';
  let remoteDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-git-test-'));
    repoDir = path.join(tempDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });

    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'DevDesk Tests']);
    runGit(['config', 'user.email', 'devdesk-tests@example.com']);

    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const value = 1;\n');
    runGit(['add', '.']);
    runGit(['commit', '-m', 'Initial commit']);

    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const value = 2;\nexport const updated = true;\n');
    runGit(['add', '.']);
    runGit(['commit', '-m', 'Update tracked file']);

    remoteDir = path.join(tempDir, 'remote.git');
    execSync('git init --bare --initial-branch=main remote.git', { cwd: tempDir, stdio: 'ignore' });
    runGit(['remote', 'add', 'origin', remoteDir]);
    runGit(['push', '-u', 'origin', 'main']);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function runGit(args: string[]): string {
    return execSync(`git ${args.map((arg) => `"${arg}"`).join(' ')}`, {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  }

  it('detects git repositories and reports basic metadata', () => {
    expect(isGitRepo(repoDir)).toBe(true);
    expect(getCurrentBranch(repoDir)).toBeTruthy();
    expect(getCommitCount(repoDir)).toBe(2);
    expect(getContributors(repoDir)).toContain('DevDesk Tests <devdesk-tests@example.com>');
  });

  it('returns recent commits, churn, and hotspots', () => {
    const recent = getRecentCommits(repoDir, 5);
    const churn = getFileChurn(repoDir, 5);
    const hotspots = getHotspots(repoDir, 5);

    expect(recent).toHaveLength(2);
    expect(recent[0].files).toContain('src/tracked.ts');
    expect(churn[0].path).toBe('src/tracked.ts');
    expect(churn[0].commits).toBeGreaterThanOrEqual(2);
    expect(churn[0].authors).toContain('DevDesk Tests <devdesk-tests@example.com>');
    expect(churn[0].lastModified).toBeTruthy();
    expect(churn[0].linesAdded).toBeGreaterThan(0);
    expect(churn[0].linesDeleted).toBeGreaterThan(0);
    expect(hotspots[0].path).toBe('src/tracked.ts');
    expect(['low', 'medium', 'high']).toContain(hotspots[0].risk);
  });

  it('reports working tree state and resolved hotspots', () => {
    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const dirty = true;\n');
    fs.writeFileSync(path.join(repoDir, 'notes.md'), '# scratch\n');

    const workingTree = getWorkingTree(repoDir);
    const resolved = resolveHotspots(repoDir, [{ path: 'src/tracked.ts', score: 90, commits: 2, recency: 1, risk: 'high' }]);

    expect(workingTree.isClean).toBe(false);
    expect(workingTree.hasUntrackedChanges).toBe(true);
    expect(workingTree.files.some((file) => file.path === 'notes.md' && file.summary === 'untracked')).toBe(true);
    expect(resolved[0].path.endsWith('/src/tracked.ts')).toBe(true);
    expect(resolved[0].repositoryPath.endsWith('/repo')).toBe(true);
  });

  it('returns a complete git insights payload', () => {
    const insights = getGitInsights(repoDir, { limit: 3 });

    expect(insights.totalCommits).toBe(2);
    expect(insights.recentCommits.length).toBeGreaterThan(0);
    expect(insights.churnFiles.length).toBeGreaterThan(0);
    expect(insights.hotspots.length).toBeGreaterThan(0);
    expect(insights.workingTree.isClean).toBe(true);
  });
});
