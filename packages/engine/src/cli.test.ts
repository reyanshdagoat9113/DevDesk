import { describe, expect, it, vi } from 'vitest';
import { createProgram } from './cli.js';

describe('cli', () => {
  it('reports worker availability without opening an index', async () => {
    const engine = {
      indexRepository: vi.fn(),
      searchIndex: vi.fn(),
      getStats: vi.fn(),
      getGitInsights: vi.fn(),
    };
    const write = vi.fn();

    await createProgram(engine as never, write).parseAsync(['node', 'engine', 'ping'], { from: 'node' });

    expect(write).toHaveBeenCalledWith(JSON.stringify({ ok: true, version: '0.1.0' }));
  });

  it('passes index options through to the engine', async () => {
    const engine = {
      indexRepository: vi.fn(async () => ({ ok: true })),
      searchIndex: vi.fn(),
      getStats: vi.fn(),
      getGitInsights: vi.fn(),
    };
    const program = createProgram(engine as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await program.parseAsync(['node', 'engine', 'index', '/repo', '--db', '/tmp/index.sqlite', '--full'], { from: 'node' });
    } finally {
      logSpy.mockRestore();
    }

    expect(engine.indexRepository).toHaveBeenCalledWith({
      repo: '/repo',
      db: '/tmp/index.sqlite',
      incremental: false,
    });
  });

  it('passes search options through to the engine', async () => {
    const engine = {
      indexRepository: vi.fn(),
      searchIndex: vi.fn(async () => ({ ok: true, results: [] })),
      getStats: vi.fn(),
      getGitInsights: vi.fn(),
    };
    const program = createProgram(engine as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await program.parseAsync(['node', 'engine', 'search', 'needle', '.', '--db', '/tmp/search.sqlite', '--regex', '--limit', '7'], { from: 'node' });
    } finally {
      logSpy.mockRestore();
    }

    expect(engine.searchIndex).toHaveBeenCalledWith({
      db: '/tmp/search.sqlite',
      query: 'needle',
      regex: true,
      limit: 7,
    });
  });

  it('passes git limit through to the engine', async () => {
    const engine = {
      indexRepository: vi.fn(),
      searchIndex: vi.fn(),
      getStats: vi.fn(),
      getGitInsights: vi.fn(() => ({ branch: 'main', totalCommits: 1, contributors: [], hotspots: [], recentCommits: [], churnFiles: [], workingTree: { isClean: true, hasStagedChanges: false, hasUnstagedChanges: false, hasUntrackedChanges: false, hasConflicts: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, conflictedCount: 0, ahead: 0, behind: 0, files: [] } })),
    };
    const program = createProgram(engine as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await program.parseAsync(['node', 'engine', 'git', '/repo', '--limit', '3'], { from: 'node' });
    } finally {
      logSpy.mockRestore();
    }

    expect(engine.getGitInsights).toHaveBeenCalledWith('/repo', { limit: 3 });
  });
});
