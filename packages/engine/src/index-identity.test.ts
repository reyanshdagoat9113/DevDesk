import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'
import { DatabaseManager } from './db/manager.js'
import { indexRepositoryCapability } from './capabilities/index-repository.js'
import type { FileInfo } from './types.js'

class FakeWorker {
  constructor(private files: FileInfo[]) {}

  async scanRepository(): Promise<FileInfo[]> {
    return this.files
  }

  async searchRegex(): Promise<never[]> {
    return []
  }
}

let tempRoot = ''

afterEach(() => {
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
  tempRoot = ''
})

function makeFile(repo: string, rel: string, content: string): FileInfo {
  const abs = path.join(repo, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
  const stat = fs.statSync(abs)
  return {
    path: abs,
    filename: path.basename(rel),
    extension: path.extname(rel).slice(1) || null,
    size_bytes: stat.size,
    mtime_ms: stat.mtimeMs,
    content_hash: `hash-${content}`,
    is_binary: false,
    content,
  }
}

describe('incremental index identity', () => {
  it('keeps renamed files with identical content', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-idx-'))
    const repo = path.join(tempRoot, 'repo')
    const dbPath = path.join(tempRoot, 'index.sqlite')
    fs.mkdirSync(repo, { recursive: true })

    const first = [makeFile(repo, 'src/a.ts', 'const x = 1')]
    await indexRepositoryCapability({ worker: new FakeWorker(first) as never }, {
      repo,
      db: dbPath,
      incremental: false,
    })

    const renamed = [makeFile(repo, 'src/b.ts', 'const x = 1')]
    fs.rmSync(path.join(repo, 'src/a.ts'), { force: true })
    await indexRepositoryCapability({ worker: new FakeWorker(renamed) as never }, {
      repo,
      db: dbPath,
      incremental: true,
    })

    const db = new DatabaseManager(dbPath)
    try {
      const paths = [...db.getAllPaths()].map((p) => p.replace(/\\/g, '/'))
      assert.ok(paths.some((p) => p.endsWith('/src/b.ts')), `expected b.ts in ${paths.join(',')}`)
      assert.ok(!paths.some((p) => p.endsWith('/src/a.ts')), 'old path should be removed')
    } finally {
      db.close()
    }
  })

  it('indexes duplicate-content files at distinct paths', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-idx-dup-'))
    const repo = path.join(tempRoot, 'repo')
    const dbPath = path.join(tempRoot, 'index.sqlite')
    fs.mkdirSync(repo, { recursive: true })

    const files = [
      makeFile(repo, 'one.ts', 'same'),
      makeFile(repo, 'two.ts', 'same'),
    ]
    await indexRepositoryCapability({ worker: new FakeWorker(files) as never }, {
      repo,
      db: dbPath,
      incremental: true,
    })

    const db = new DatabaseManager(dbPath)
    try {
      assert.equal(db.getAllPaths().size, 2)
    } finally {
      db.close()
    }
  })
})
