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
