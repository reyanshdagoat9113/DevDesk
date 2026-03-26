import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  buildEngineIndexArgs,
  buildEngineSearchArgs,
  buildEngineStatsArgs,
  getEngineDbPathFromUserData,
  resolveEngineBinaryPath,
} from './runtime'

test('resolveEngineBinaryPath prefers existing dev candidate when unpackaged', () => {
  const appPath = '/workspace/DevDesk'
  const moduleDirname = '/workspace/DevDesk/dist/main/engine'
  const existingPath = path.join(appPath, '..', 'devdesk-addons', 'devdesk-engine', 'dist', 'cli.js')

  const resolved = resolveEngineBinaryPath({
    appPath,
    moduleDirname,
    resourcesPath: '/workspace/DevDesk/dist/linux-unpacked/resources',
    isPackaged: false,
    existsSync: (targetPath) => targetPath === existingPath,
  })

  assert.equal(resolved, existingPath)
})

test('resolveEngineBinaryPath uses packaged resource path when packaged', () => {
  const resolved = resolveEngineBinaryPath({
    appPath: '/workspace/DevDesk',
    moduleDirname: '/workspace/DevDesk/dist/main/engine',
    resourcesPath: '/workspace/DevDesk/dist/linux-unpacked/resources',
    isPackaged: true,
    existsSync: () => false,
  })

  assert.equal(resolved, '/workspace/DevDesk/dist/linux-unpacked/resources/engine/cli.js')
})

test('getEngineDbPathFromUserData keeps dbs under the app user data directory', () => {
  assert.equal(
    getEngineDbPathFromUserData('/tmp/devdesk-user', 'project-123'),
    '/tmp/devdesk-user/engine/project-123.sqlite'
  )
})

test('engine command builders keep db paths explicit and consistent', () => {
  const dbPath = '/tmp/devdesk-user/engine/project-123.sqlite'

  assert.deepEqual(buildEngineIndexArgs('/repos/acme', dbPath), ['index', '/repos/acme', '--db', dbPath])
  assert.deepEqual(buildEngineSearchArgs('router', dbPath), ['search', 'router', '--db', dbPath])
  assert.deepEqual(buildEngineSearchArgs('router', dbPath, { regex: true, limit: 25 }), [
    'search',
    'router',
    '--db',
    dbPath,
    '--regex',
    '--limit',
    '25',
  ])
  assert.deepEqual(buildEngineStatsArgs(dbPath), ['stats', '--db', dbPath])
})
