import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { isGitRepo, getGitInsights } from './git.js';

describe('git', () => {
  describe('isGitRepo', () => {
    it('returns true for this git repository', () => {
      // This project should be a git repo
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      expect(isGitRepo(projectRoot)).toBe(true);
    });

    it('returns false for non-git directory', () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-non-git-'));
      expect(isGitRepo(nonGitDir)).toBe(false);
      fs.rmSync(nonGitDir, { recursive: true });
    });

    it('returns false for temp directory', () => {
      expect(isGitRepo(os.tmpdir())).toBe(false);
    });
  });

  describe('getGitInsights', () => {
    it('throws for non-git directory', () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-non-git-'));
      expect(() => getGitInsights(nonGitDir)).toThrow('Not a git repository');
      fs.rmSync(nonGitDir, { recursive: true });
    });

    it('returns insights for this git repository', () => {
      const projectRoot = path.resolve(import.meta.dirname, '..', '..');
      const insights = getGitInsights(projectRoot);

      expect(insights.branch).toBeDefined();
      expect(insights.totalCommits).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(insights.contributors)).toBe(true);
      expect(Array.isArray(insights.hotspots)).toBe(true);
      expect(Array.isArray(insights.recentCommits)).toBe(true);
      expect(Array.isArray(insights.churnFiles)).toBe(true);
    });
  });
});
