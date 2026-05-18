import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { Project } from '../data/model'
import { inspectProjectHealth } from './healthInspector'

describe('project health inspector', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-health-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function project(overrides: Partial<Project> = {}): Project {
    return {
      id: 'project-1',
      name: 'Test Project',
      path: tempDir,
      type: 'node',
      icon: 'box',
      linkedContainerNames: [],
      ...overrides,
    }
  }

  it('detects node package metadata and missing dependencies', () => {
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}\n')
    fs.writeFileSync(path.join(tempDir, '.nvmrc'), '20\n')
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      scripts: {
        dev: 'vite',
        test: 'vitest',
      },
    }))

    const report = inspectProjectHealth(project())

    expect(report.packageManager).toBe('npm')
    expect(report.hasLockfile).toBe(true)
    expect(report.hasNodeModules).toBe(false)
    expect(report.nodeVersion).toBe('20')
    expect(report.availableScripts).toEqual(['dev', 'test'])
    expect(report.missingDeps).toBe(true)
    expect(report.status).toBe('warning')
    expect(report.suggestions).toContainEqual(expect.objectContaining({
      id: 'missing-dependencies',
      action: { label: 'Install dependencies', command: 'npm install' },
    }))
  })

  it('returns a critical report when the project path is unavailable', () => {
    const missingPath = path.join(tempDir, 'missing')

    const report = inspectProjectHealth(project({ path: missingPath }))

    expect(report.status).toBe('critical')
    expect(report.suggestions[0]).toMatchObject({
      id: 'project-path-missing',
      type: 'warning',
    })
  })

  it('detects non-node package managers without node_modules checks', () => {
    fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '[tool.poetry]\nname = "example"\n')
    fs.writeFileSync(path.join(tempDir, 'poetry.lock'), '')

    const report = inspectProjectHealth(project({ type: 'python' }))

    expect(report.packageManager).toBe('poetry')
    expect(report.hasLockfile).toBe(true)
    expect(report.hasNodeModules).toBeUndefined()
    expect(report.missingDeps).toBe(false)
  })
})
