import { describe, it, expect, vi } from 'vitest';
import { createProgram } from './cli.js';

describe('cli', () => {
  it('passes git limit through to the engine', async () => {
    let capturedLimit: number | undefined;
    let capturedRepoPath: string | undefined;

    const engine = {
      indexRepository: vi.fn(),
      searchIndex: vi.fn(),
      getStats: vi.fn(),
      getGitInsights: vi.fn((repoPath: string, options: { limit?: number }) => {
        capturedRepoPath = repoPath;
        capturedLimit = options.limit;

        return {
          branch: 'main',
          totalCommits: 1,
          contributors: [],
          hotspots: [],
          recentCommits: [],
          churnFiles: [],
          workingTree: {
            isClean: true,
            hasStagedChanges: false,
            hasUnstagedChanges: false,
            hasUntrackedChanges: false,
            hasConflicts: false,
            stagedCount: 0,
            unstagedCount: 0,
            untrackedCount: 0,
            conflictedCount: 0,
            ahead: 0,
            behind: 0,
            files: [],
          },
        };
      }),
    };

    const program = createProgram(engine as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await program.parseAsync(['node', 'engine', 'git', '/repo', '--limit', '3'], { from: 'node' });
    } finally {
      logSpy.mockRestore();
    }

    expect(capturedLimit).toBe(3);
    expect(capturedRepoPath).toBe('/repo');
  });
});
