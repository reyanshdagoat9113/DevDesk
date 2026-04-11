import { describe, expect, it } from 'vitest'
import {
  buildEngineGitArgs,
  buildEngineIndexArgs,
  buildEngineSearchArgs,
  buildEngineStatsArgs,
  getEngineDbPathFromUserData,
  resolveEngineBinaryPath,
} from './runtime'

describe('engine runtime helpers', () => {
  it('resolves a dev engine binary from available candidates', () => {
    const target = '/workspace/devdesk-addons/devdesk-engine/dist/cli.js'
    const resolved = resolveEngineBinaryPath({
      appPath: '/workspace/DevDesk',
      moduleDirname: '/workspace/DevDesk/dist/main/engine',
      resourcesPath: '/workspace/DevDesk/resources',
      isPackaged: false,
      existsSync: (candidate) => candidate === target,
    })

    expect(resolved).toBe(target)
  })

  it('falls back to packaged engine resources', () => {
    const resolved = resolveEngineBinaryPath({
      appPath: '/workspace/DevDesk',
      moduleDirname: '/workspace/DevDesk/dist/main/engine',
      resourcesPath: '/workspace/DevDesk/resources',
      isPackaged: true,
      existsSync: () => false,
    })

    expect(resolved).toBe('/workspace/DevDesk/resources/engine/cli.js')
  })

  it('builds engine command arguments consistently', () => {
    expect(getEngineDbPathFromUserData('/tmp/user-data', 'proj-1')).toBe('/tmp/user-data/engine/proj-1.sqlite')
    expect(buildEngineIndexArgs('/repo', '/tmp/index.sqlite')).toEqual(['index', '/repo', '--db', '/tmp/index.sqlite'])
    expect(buildEngineSearchArgs('needle', '/tmp/index.sqlite', { regex: true, limit: 5 })).toEqual(['search', 'needle', '--db', '/tmp/index.sqlite', '--regex', '--limit', '5'])
    expect(buildEngineStatsArgs('/tmp/index.sqlite')).toEqual(['stats', '--db', '/tmp/index.sqlite'])
    expect(buildEngineGitArgs('/repo')).toEqual(['git', '/repo'])
  })
})
