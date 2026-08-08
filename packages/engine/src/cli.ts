#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { Engine } from './engine.js';
import { getDefaultDbPath, resolvePath } from './utils.js';

const VERSION = '0.1.0';
type OutputWriter = (value: string) => void;

export function createProgram(
  engine: Engine = new Engine(),
  write: OutputWriter = (value) => console.log(value),
): Command {
  const program = new Command();

  program
    .name('engine')
    .description('Fast local code intelligence engine')
    .version(VERSION);

  program
    .command('ping')
    .description('Verify that the engine worker is available')
    .action(() => {
      write(JSON.stringify({ ok: true, version: VERSION }));
    });

  program
    .command('index <path>')
    .description('Index a repository')
    .option('--db <path>', 'Database path')
    .option('--full', 'Force full reindex (ignore existing)', false)
    .option(
      '--profile <name>',
      'Index profile: source-first | source-docs | full-text (default: source-first)',
      'source-first',
    )
    .action(async (repoPath, options) => {
      const dbPath = options.db ? resolvePath(options.db) : getDefaultDbPath(repoPath);
      const result = await engine.indexRepository({
        repo: repoPath,
        db: dbPath,
        incremental: !options.full,
        profile: options.profile,
      });
      write(JSON.stringify(result, null, 2));
    });

  program
    .command('search <query> [path]')
    .description('Search the index')
    .option('--db <path>', 'Database path')
    .option('--regex', 'Treat query as regex', false)
    .option('-l, --limit <n>', 'Max results', '50')
    .action(async (query, repoPath, options) => {
      const dbPath = options.db ? resolvePath(options.db) : getDefaultDbPath(repoPath || '.');
      const result = await engine.searchIndex({
        db: dbPath,
        query,
        regex: options.regex,
        limit: parseInt(options.limit, 10),
      });
      write(JSON.stringify(result, null, 2));
    });

  program
    .command('stats [path]')
    .description('Show index statistics')
    .option('--db <path>', 'Database path')
    .action((repoPath, options) => {
      const dbPath = options.db ? resolvePath(options.db) : getDefaultDbPath(repoPath || '.');
      const result = engine.getStats(dbPath);
      write(JSON.stringify(result, null, 2));
    });

  program
    .command('git <path>')
    .description('Show git insights for a repository')
    .option('-l, --limit <n>', 'Max hotspots to show', '10')
    .action((repoPath, options) => {
      try {
        const result = engine.getGitInsights(resolvePath(repoPath), {
          limit: parseInt(options.limit, 10),
        });

        write(
          JSON.stringify(
            {
              ok: true,
              ...result,
            },
            null,
            2
          )
        );
      } catch (error) {
        write(
          JSON.stringify(
            {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              path: resolvePath(repoPath),
            },
            null,
            2
          )
        );
      }
    });

  return program;
}

export async function runCli(
  argv: string[] = process.argv,
  write: OutputWriter = (value) => console.log(value),
): Promise<void> {
  await createProgram(new Engine(), write).parseAsync(argv, { from: 'node' });
}

const isMainModule = path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url);

if (isMainModule) {
  void runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
