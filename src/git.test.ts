import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  isGitRepo,
  getCurrentBranch,
  getCommitCount,
  getContributors,
  getRecentCommits,
  getFileChurn,
  getHotspots,
  getGitInsights,
} from './git.js';

describe('git', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-git-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

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

      expect(typeof insights.branch).toBe('string');
      expect(typeof insights.totalCommits).toBe('number');
      expect(Array.isArray(insights.contributors)).toBe(true);
      expect(Array.isArray(insights.hotspots)).toBe(true);
      expect(Array.isArray(insights.recentCommits)).toBe(true);
      expect(Array.isArray(insights.churnFiles)).toBe(true);
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
      const commits = getRecentCommits(projectRoot,5);

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
});
