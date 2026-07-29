import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'
import { DatabaseManager } from './db/manager.js'
import { searchIndexCapability } from './capabilities/search.js'
import { chunkPathsForArgv } from './workers/client.js'
import type { FileInfo, RustFileResult } from './types.js'

class FakeWorker {
  constructor(private regexImpl: (pattern: string, files: string[]) => Promise<RustFileResult[]>) {}
  scanRepository(): Promise<FileInfo[]> {
    return Promise.resolve([])
  }
  searchRegex(pattern: string, files: string[]) {
    return this.regexImpl(pattern, files)
  }
}

let tempRoot = ''

afterEach(() => {
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
  tempRoot = ''
})

describe('regex search semantics', () => {
  it('returns ok:false for invalid regex without throwing', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-re-'))
    const dbPath = path.join(tempRoot, 'db.sqlite')
    const db = new DatabaseManager(dbPath)
    db.upsertFiles([
      {
        path: path.join(tempRoot, 'a.ts'),
        filename: 'a.ts',
        extension: 'ts',
        size_bytes: 1,
        mtime_ms: Date.now(),
        content_hash: 'h',
        language: 'typescript',
        is_binary: false,
        content: 'const foo = 1',
      },
    ])
    db.close()

    const result = await searchIndexCapability(
      {
        worker: new FakeWorker(async () => {
          throw new Error('should not spawn for invalid regex')
        }) as never,
      },
      { db: dbPath, query: '[invalid(', regex: true, limit: 10 },
    )

    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /Invalid regex/i)
  })

  it('searches all indexed paths, not only FTS candidates', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-re2-'))
    const dbPath = path.join(tempRoot, 'db.sqlite')
    const target = path.join(tempRoot, 'needle.ts')
    const db = new DatabaseManager(dbPath)
    db.upsertFiles([
      {
        path: target,
        filename: 'needle.ts',
        extension: 'ts',
        size_bytes: 10,
        mtime_ms: Date.now(),
        content_hash: 'h2',
        language: 'typescript',
        is_binary: false,
        content: 'zzz unique_token_xyz zzz',
      },
    ])
    db.close()

    let receivedFiles: string[] = []
    const result = await searchIndexCapability(
      {
        worker: new FakeWorker(async (_pattern, files) => {
          receivedFiles = files
          return [
            {
              path: target,
              matches: [{ line: 1, column: 1, text: 'unique_token_xyz', before: [], after: [] }],
            },
          ]
        }) as never,
      },
      // Query unlikely to FTS-match the same way; regex path should still include file
      { db: dbPath, query: 'unique_token_xyz', regex: true, limit: 10 },
    )

    assert.equal(result.ok, true)
    assert.ok(receivedFiles.some((f) => f.includes('needle.ts')))
    assert.equal(result.results.length, 1)
    assert.equal(result.results[0].matches[0].snippet, 'unique_token_xyz')
  })
})

describe('regex path list argv bounding', () => {
  it('batches paths so no --files argument exceeds the platform budget', () => {
    const paths = Array.from({ length: 500 }, (_, i) => `C:/repo/src/file-${i}-${'x'.repeat(60)}.ts`)
    const batches = chunkPathsForArgv(paths, 1_000)

    assert.ok(batches.length > 1, 'expected multiple batches')
    assert.deepEqual(batches.flat(), paths, 'no path may be dropped')
    for (const batch of batches) {
      assert.ok(batch.length > 0)
      assert.ok(batch.join(',').length <= 1_000, `batch too long: ${batch.join(',').length}`)
    }
  })

  it('keeps a single batch when the list fits and never emits empty batches', () => {
    assert.deepEqual(chunkPathsForArgv(['a.ts', 'b.ts'], 1_000), [['a.ts', 'b.ts']])
    assert.deepEqual(chunkPathsForArgv([], 1_000), [])
  })

  it('keeps an oversized single path in its own batch rather than dropping it', () => {
    const huge = 'x'.repeat(2_000)
    assert.deepEqual(chunkPathsForArgv([huge, 'small.ts'], 100), [[huge], ['small.ts']])
  })
})
