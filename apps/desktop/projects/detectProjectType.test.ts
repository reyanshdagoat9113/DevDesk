import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectProjectType, getProjectIcon } from './detectProjectType'

describe('detectProjectType', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-type-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('detects node project by package.json', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}')
    expect(detectProjectType(tempDir)).toBe('node')
  })

  it('detects python project by pyproject.toml', () => {
    fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[tool.poetry]')
    expect(detectProjectType(tempDir)).toBe('python')
  })

  it('detects python project by requirements.txt', () => {
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask')
    expect(detectProjectType(tempDir)).toBe('python')
  })

  it('detects python project by setup.py', () => {
    fs.writeFileSync(path.join(tempDir, 'setup.py'), 'from setuptools import setup')
    expect(detectProjectType(tempDir)).toBe('python')
  })

  it('detects rust project by Cargo.toml', () => {
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]')
    expect(detectProjectType(tempDir)).toBe('rust')
  })

  it('detects go project by go.mod', () => {
    fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module example')
    expect(detectProjectType(tempDir)).toBe('go')
  })

  it('returns unknown for empty directory', () => {
    expect(detectProjectType(tempDir)).toBe('unknown')
  })

  it('returns unknown for nonexistent path', () => {
    expect(detectProjectType(path.join(tempDir, 'missing'))).toBe('unknown')
  })

  it('returns unknown for dir with only unrecognized files', () => {
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Hello')
    fs.writeFileSync(path.join(tempDir, 'Makefile'), 'all:')
    expect(detectProjectType(tempDir)).toBe('unknown')
  })
})

describe('getProjectIcon', () => {
  it('returns correct icons for known project types', () => {
    expect(getProjectIcon('node')).toBe('⚡')
    expect(getProjectIcon('python')).toBe('🐍')
    expect(getProjectIcon('rust')).toBe('🦀')
    expect(getProjectIcon('go')).toBe('🐹')
  })

  it('returns folder icon for unknown type', () => {
    expect(getProjectIcon('unknown')).toBe('📁')
  })
})
