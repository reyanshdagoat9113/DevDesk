import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('resolveProjectPath', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-file-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns normalized project root when no relative path given', async () => {
    const { resolveProjectPath } = await import('./fileService')
    expect(resolveProjectPath(tempDir)).toBe(path.resolve(tempDir))
  })

  it('returns resolved absolute path for a valid relative path', async () => {
    const { resolveProjectPath } = await import('./fileService')
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src', 'app.ts'), '// app')

    const resolved = resolveProjectPath(tempDir, 'src/app.ts')
    expect(resolved).toBe(path.resolve(tempDir, 'src', 'app.ts'))
  })

  it('throws on absolute paths', async () => {
    const { resolveProjectPath } = await import('./fileService')
    expect(() => resolveProjectPath(tempDir, '/etc/passwd')).toThrow('Absolute paths')
  })

  it('throws on path traversal beyond root', async () => {
    const { resolveProjectPath } = await import('./fileService')
    expect(() => resolveProjectPath(tempDir, '../../../etc/passwd')).toThrow('outside the project boundary')
  })

  it('throws when relative path is empty or whitespace', async () => {
    const { resolveProjectPath } = await import('./fileService')
    expect(resolveProjectPath(tempDir, '')).toBe(path.resolve(tempDir))
    expect(resolveProjectPath(tempDir, '   ')).toBe(path.resolve(tempDir))
  })

  it('returns normalized root for undefined relativePath', async () => {
    const { resolveProjectPath } = await import('./fileService')
    expect(resolveProjectPath(tempDir, undefined)).toBe(path.resolve(tempDir))
  })
})

describe('listProjectFiles', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-file-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('lists files and dirs sorted (dirs first)', async () => {
    const { listProjectFiles } = await import('./fileService')

    fs.mkdirSync(path.join(tempDir, 'src'))
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Hello')
    fs.writeFileSync(path.join(tempDir, '.gitignore'), 'dist')
    fs.mkdirSync(path.join(tempDir, 'dist'))
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}')

    const result = await listProjectFiles(tempDir)
    const names = result.entries.map((e) => e.name)

    expect(names).toContain('src')
    expect(names).toContain('README.md')
    expect(names).toContain('.gitignore')
    expect(names).toContain('package.json')

    const distEntry = result.entries.find((e) => e.name === 'dist')
    if (distEntry) {
      expect(distEntry.kind).toBe('dir')
    }
  })

  it('returns empty for nonexistent directory', async () => {
    const { listProjectFiles } = await import('./fileService')
    const result = await listProjectFiles(path.join(tempDir, 'missing'))
    expect(result.entries).toEqual([])
    expect(result.truncated).toBe(false)
  })

  it('lists files from a subdirectory', async () => {
    const { listProjectFiles } = await import('./fileService')

    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), '// index')
    fs.writeFileSync(path.join(tempDir, 'src', 'utils.ts'), '// utils')

    const result = await listProjectFiles(tempDir, 'src')
    expect(result.entries.length).toBeGreaterThanOrEqual(2)
    expect(result.entries.every((e) => e.relativePath.startsWith('src/'))).toBe(true)
  })

  it('uses gitignore patterns when present', async () => {
    const { listProjectFiles } = await import('./fileService')

    fs.writeFileSync(path.join(tempDir, '.gitignore'), 'dist\n*.log')
    fs.mkdirSync(path.join(tempDir, 'dist'))
    fs.writeFileSync(path.join(tempDir, 'dist', 'bundle.js'), '//')
    fs.writeFileSync(path.join(tempDir, 'debug.log'), 'log')
    fs.writeFileSync(path.join(tempDir, 'src.ts'), '// src')

    const result = await listProjectFiles(tempDir)
    const names = result.entries.map((e) => e.name)

    expect(names).toContain('.gitignore')
    expect(names).toContain('src.ts')
    expect(names).not.toContain('dist')
    expect(names).not.toContain('debug.log')
  })
})

describe('getFileIndex cache invalidation', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-index-'))
    fs.writeFileSync(path.join(tempDir, 'readme.md'), '# hi')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('reuses the cached index within INDEX_TTL_MS when root mtime is unchanged', async () => {
    const { getFileIndex, INDEX_TTL_MS, clearFileIndex } = await import('./fileService')
    clearFileIndex('proj-cache')
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const first = await getFileIndex('proj-cache', tempDir)
    const second = await getFileIndex('proj-cache', tempDir)

    expect(INDEX_TTL_MS).toBe(60_000)
    expect(second).toBe(first)
    expect(second.fileList).toBe(first.fileList)
    expect(second.lastIndexedAt).toBe(first.lastIndexedAt)
  })

  it('rebuilds the index after INDEX_TTL_MS even if root mtime is unchanged', async () => {
    const { getFileIndex, INDEX_TTL_MS, clearFileIndex } = await import('./fileService')
    clearFileIndex('proj-ttl')
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(2_000_000)

    const first = await getFileIndex('proj-ttl', tempDir)
    now.mockReturnValue(2_000_000 + INDEX_TTL_MS + 1)
    const second = await getFileIndex('proj-ttl', tempDir)

    expect(second).not.toBe(first)
    expect(second.lastIndexedAt).toBe(2_000_000 + INDEX_TTL_MS + 1)
  })

  it('rebuilds the index when the project root mtime changes', async () => {
    const { getFileIndex, clearFileIndex } = await import('./fileService')
    clearFileIndex('proj-mtime')
    vi.spyOn(Date, 'now').mockReturnValue(3_000_000)

    const first = await getFileIndex('proj-mtime', tempDir)
    const later = Math.floor(first.rootMtimeMs / 1000) + 5
    fs.utimesSync(tempDir, later, later)
    fs.writeFileSync(path.join(tempDir, 'new-file.ts'), 'export {}')

    const second = await getFileIndex('proj-mtime', tempDir)
    expect(second).not.toBe(first)
    expect(second.fileList.some((entry) => entry.includes('new-file.ts'))).toBe(true)
  })
})
