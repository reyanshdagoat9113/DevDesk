import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  isGitRepo,
  getCurrentBranch,
  getCommitCount,
  getContributors,
  getRecentCommits,
  getFileChurn,
  getHotspots,
  getGitInsights,
  getWorkingTree,
} from './git.js';

describe('git', () => {
  let tempDir: string;
  let repoDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-git-test-'));
    repoDir = path.join(tempDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function runGit(args: string[], cwd: string = repoDir): string {
    const command = `git ${args.map((arg) => `"${arg}"`).join(' ')}`;
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
    }).trim();
  }

  function setupRepoWithHistory(): void {
    runGit(['init']);
    runGit(['config', 'user.name', 'DevDesk Tests']);
    runGit(['config', 'user.email', 'devdesk-tests@example.com']);

    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'src', 'tracked.ts'), 'export const value = 1;\n');
    runGit(['add', '.']);
    runGit(['commit', '-m', 'Initial commit']);

    fs.writeFileSync(
      path.join(repoDir, 'src', 'tracked.ts'),
      'export const value = 2;\nexport const added = true;\n'
    );
    runGit(['add', '.']);
    runGit(['commit', '-m', 'Update tracked file']);
  }

  describe('isGitRepo', () => {
    it('returns false for non-git directory', () => {
      expect(isGitRepo(tempDir)).toBe(false);
    });

    it('returns false for temp directory', () => {
      expect(isGitRepo(os.tmpdir())).toBe(false);
    });

    it('returns true for this repository', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      expect(isGitRepo(projectRoot)).toBe(true);
    });

    it('returns true for a nested directory inside a git repository', () => {
      setupRepoWithHistory();
      const nestedDir = path.join(repoDir, 'src');
      expect(isGitRepo(nestedDir)).toBe(true);
    });
  });

  describe('getGitInsights', () => {
    it('throws error for non-git directory', () => {
      expect(() => getGitInsights(tempDir)).toThrow('Not a git repository');
    });

    it('returns complete insights object for git repository', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const insights = getGitInsights(projectRoot);

      expect(insights).toHaveProperty('branch');
      expect(insights).toHaveProperty('totalCommits');
      expect(insights).toHaveProperty('contributors');
      expect(insights).toHaveProperty('hotspots');
      expect(insights).toHaveProperty('recentCommits');
      expect(insights).toHaveProperty('churnFiles');
      expect(insights).toHaveProperty('workingTree');

      expect(typeof insights.branch).toBe('string');
      expect(typeof insights.totalCommits).toBe('number');
      expect(Array.isArray(insights.contributors)).toBe(true);
      expect(Array.isArray(insights.hotspots)).toBe(true);
      expect(Array.isArray(insights.recentCommits)).toBe(true);
      expect(Array.isArray(insights.churnFiles)).toBe(true);
      expect(typeof insights.workingTree.isClean).toBe('boolean');
    });
  });

  describe('getCurrentBranch', () => {
    it('returns branch name for git repository', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const branch = getCurrentBranch(projectRoot);
      expect(typeof branch).toBe('string');
    });
  });

  describe('getCommitCount', () => {
    it('returns number >= 0 for git repository', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const count = getCommitCount(projectRoot);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getContributors', () => {
    it('returns array for git repository', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const contributors = getContributors(projectRoot);
      expect(Array.isArray(contributors)).toBe(true);
    });
  });

  describe('getRecentCommits', () => {
    it('returns array of commit objects', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const commits = getRecentCommits(projectRoot, 5);

      expect(Array.isArray(commits)).toBe(true);
      commits.forEach((commit) => {
        expect(commit).toHaveProperty('hash');
        expect(commit).toHaveProperty('author');
        expect(commit).toHaveProperty('date');
        expect(commit).toHaveProperty('message');
        expect(commit).toHaveProperty('files');
      });
    });

    it('respects limit parameter', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const commits = getRecentCommits(projectRoot, 3);
      expect(commits.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getHotspots', () => {
    it('returns array of hotspot objects with risk levels', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const hotspots = getHotspots(projectRoot, 10);

      expect(Array.isArray(hotspots)).toBe(true);
      hotspots.forEach((hotspot) => {
        expect(hotspot).toHaveProperty('path');
        expect(hotspot).toHaveProperty('score');
        expect(hotspot).toHaveProperty('commits');
        expect(hotspot).toHaveProperty('recency');
        expect(hotspot).toHaveProperty('risk');
        expect(['low', 'medium', 'high']).toContain(hotspot.risk);
      });
    });
  });

  describe('getFileChurn', () => {
    it('returns array of churn objects', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const churn = getFileChurn(projectRoot, 10);

      expect(Array.isArray(churn)).toBe(true);
      churn.forEach((file) => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('commits');
        expect(file).toHaveProperty('authors');
        expect(file).toHaveProperty('lastModified');
        expect(file).toHaveProperty('linesAdded');
        expect(file).toHaveProperty('linesDeleted');
      });
    });
  });

  describe('getWorkingTree', () => {
    it('returns clean status for a freshly committed repository', () => {
      setupRepoWithHistory();

      const workingTree = getWorkingTree(repoDir);

      expect(workingTree.isClean).toBe(true);
      expect(workingTree.files).toHaveLength(0);
      expect(workingTree.hasStagedChanges).toBe(false);
      expect(workingTree.hasUnstagedChanges).toBe(false);
      expect(workingTree.hasUntrackedChanges).toBe(false);
      expect(workingTree.ahead).toBe(0);
      expect(workingTree.behind).toBe(0);
    });

    it('reports staged, unstaged, and untracked changes with file summaries', () => {
      setupRepoWithHistory();

      fs.writeFileSync(
        path.join(repoDir, 'src', 'tracked.ts'),
        'export const value = 3;\nexport const added = true;\nexport const dirty = true;\n'
      );

      fs.writeFileSync(path.join(repoDir, 'src', 'staged.ts'), 'export const staged = true;\n');
      runGit(['add', 'src/staged.ts']);

      fs.writeFileSync(path.join(repoDir, 'notes.md'), '# scratch\n');

      const workingTree = getWorkingTree(repoDir);

      expect(workingTree.isClean).toBe(false);
      expect(workingTree.hasStagedChanges).toBe(true);
      expect(workingTree.hasUnstagedChanges).toBe(true);
      expect(workingTree.hasUntrackedChanges).toBe(true);
      expect(workingTree.stagedCount).toBe(1);
      expect(workingTree.unstagedCount).toBe(1);
      expect(workingTree.untrackedCount).toBe(1);

      const stagedFile = workingTree.files.find((file) => file.path === 'src/staged.ts');
      expect(stagedFile).toMatchObject({
        summary: 'added',
        staged: true,
        unstaged: false,
        untracked: false,
      });
      expect(stagedFile?.additions).toBeGreaterThan(0);

      const dirtyFile = workingTree.files.find((file) => file.path === 'src/tracked.ts');
      expect(dirtyFile).toMatchObject({
        summary: 'modified',
        staged: false,
        unstaged: true,
        untracked: false,
      });
      expect((dirtyFile?.additions || 0) + (dirtyFile?.deletions || 0)).toBeGreaterThan(0);

      const untrackedFile = workingTree.files.find((file) => file.path === 'notes.md');
      expect(untrackedFile).toMatchObject({
        summary: 'untracked',
        staged: false,
        unstaged: false,
        untracked: true,
      });
    });

    it('is included in the broader git insights payload', () => {
      setupRepoWithHistory();
      fs.writeFileSync(path.join(repoDir, 'notes.md'), '# scratch\n');

      const insights = getGitInsights(repoDir);

      expect(insights.workingTree.isClean).toBe(false);
      expect(insights.workingTree.hasUntrackedChanges).toBe(true);
      expect(insights.workingTree.files.some((file) => file.path === 'notes.md')).toBe(true);
    });
  });
});
