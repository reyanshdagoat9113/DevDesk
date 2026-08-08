import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildEngineGitArgs,
  buildEngineIndexArgs,
  buildEngineSearchArgs,
  buildEngineStatsArgs,
  getEngineDbPathFromUserData,
  resolveEngineBinaryPath,
} from './runtime'

const appPath = '/workspace/DevDesk'
const resourcesPath = '/workspace/DevDesk/resources'

describe('engine runtime helpers', () => {
  it('resolves a dev engine binary from the workspace package', () => {
    const target = path.join(appPath, 'node_modules', 'devdesk-engine', 'dist', 'cli.js')
    const resolved = resolveEngineBinaryPath({
      appPath,
      moduleDirname: '/workspace/DevDesk/dist/main/engine',
      resourcesPath,
      isPackaged: false,
      existsSync: (candidate) => candidate === target,
    })

    expect(resolved).toBe(target)
  })

  it('falls back to packaged engine resources', () => {
    const resolved = resolveEngineBinaryPath({
      appPath,
      moduleDirname: '/workspace/DevDesk/dist/main/engine',
      resourcesPath,
      isPackaged: true,
      existsSync: () => false,
    })

    expect(resolved).toBe(path.join(resourcesPath, 'engine', 'cli.js'))
  })

  it('builds engine command arguments consistently', () => {
    const tmpUserData = '/tmp/user-data'
    const tmpIndex = '/tmp/index.sqlite'

    expect(getEngineDbPathFromUserData(tmpUserData, 'proj-1')).toBe(
      path.join(tmpUserData, 'engine', 'proj-1.sqlite')
    )
    expect(buildEngineIndexArgs('/repo', tmpIndex)).toEqual([
      'index',
      '/repo',
      '--db',
      tmpIndex,
      '--profile',
      'source-first',
      '--full',
    ])
    expect(buildEngineIndexArgs('/repo', tmpIndex, { profile: 'full-text', full: false })).toEqual([
      'index',
      '/repo',
      '--db',
      tmpIndex,
      '--profile',
      'full-text',
    ])
    expect(buildEngineSearchArgs('needle', tmpIndex, { regex: true, limit: 5 })).toEqual([
      'search', 'needle', '--db', tmpIndex, '--regex', '--limit', '5',
    ])
    expect(buildEngineStatsArgs(tmpIndex)).toEqual(['stats', '--db', tmpIndex])
    expect(buildEngineGitArgs('/repo')).toEqual(['git', '/repo'])
  })
})
