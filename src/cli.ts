#!/usr/bin/env node

import { Command } from 'commander';
import { indexRepository, searchIndex, getStats } from './index.js';
import { getDefaultDbPath } from './utils.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('devdesk-engine')
  .description('Fast local code intelligence engine')
  .version(VERSION);

// Index command
program
  .command('index')
  .description('Index a repository')
  .requiredOption('-r, --repo <path>', 'Repository path')
  .option('-d, --db <path>', 'Database path')
  .option('-i, --incremental', 'Only index changed files', false)
  .action(async (options) => {
    try {
      const dbPath = options.db || getDefaultDbPath(options.repo);
      const result = await indexRepository({
        repo: options.repo,
        db: dbPath,
        incremental: options.incremental,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      outputError('INDEX_ERROR', error);
      process.exit(1);
    }
  });

// Search command
program
  .command('search')
  .description('Search the index')
  .requiredOption('-d, --db <path>', 'Database path')
  .requiredOption('-q, --query <string>', 'Search query')
  .option('--regex', 'Treat as regex', false)
  .option('-l, --limit <n>', 'Max results', '100')
  .action(async (options) => {
    try {
      const result = await searchIndex({
        db: options.db,
        query: options.query,
        regex: options.regex,
        limit: parseInt(options.limit, 10),
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      outputError('SEARCH_ERROR', error);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show index statistics')
  .requiredOption('-d, --db <path>', 'Database path')
  .action((options) => {
    try {
      const result = getStats(options.db);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      outputError('STATS_ERROR', error);
      process.exit(1);
    }
  });

// Version command
program
  .command('version')
  .description('Show version')
  .action(() => {
    console.log(JSON.stringify({ ok: true, version: VERSION }, null, 2));
  });

function outputError(code: string, error: unknown) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: {
          code,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      null,
      2
    )
  );
}

program.parse();
