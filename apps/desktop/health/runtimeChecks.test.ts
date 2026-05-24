import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('runtimeChecks', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-runtime-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createFile(relativePath: string, content: string = '') {
    const filePath = path.join(tmpDir, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }

  function createDir(relativePath: string) {
    fs.mkdirSync(path.join(tmpDir, relativePath), { recursive: true })
  }

  async function importRuntimeChecks() {
    return import('../health/runtimeChecks')
  }

  describe('checkEnvFiles', () => {
    it('passes when .env files are found', async () => {
      createFile('.env', 'PORT=3000')
      createFile('.env.local', 'DEBUG=true')

      const { checkEnvFiles } = await importRuntimeChecks()
      const result = await checkEnvFiles(tmpDir)

      expect(result.status).toBe('pass')
      expect(result.message).toContain('.env')
      expect(result.message).toContain('.env.local')
      const details = JSON.parse(result.detailsJson)
      expect(details.found).toContain('.env')
      expect(details.found).toContain('.env.local')
    })

    it('warns when no .env files exist', async () => {
      const { checkEnvFiles } = await importRuntimeChecks()
      const result = await checkEnvFiles(tmpDir)

      expect(result.status).toBe('warning')
      expect(result.suggestedFix).toContain('Create a .env file')
    })

    it('fails when project path does not exist', async () => {
      const { checkEnvFiles } = await importRuntimeChecks()
      const result = await checkEnvFiles(path.join(tmpDir, 'nonexistent'))

      expect(result.status).toBe('fail')
    })
  })

  describe('checkDependenciesInstalled', () => {
    it('skips when no package.json exists', async () => {
      const { checkDependenciesInstalled } = await importRuntimeChecks()
      const result = await checkDependenciesInstalled(tmpDir)

      expect(result.status).toBe('skipped')
    })

    it('fails when package.json exists but node_modules is missing', async () => {
      createFile('package.json', '{"name":"test"}')

      const { checkDependenciesInstalled } = await importRuntimeChecks()
      const result = await checkDependenciesInstalled(tmpDir)

      expect(result.status).toBe('fail')
      expect(result.suggestedFix).toContain('npm install')
    })

    it('fails when lockfile exists but node_modules is missing', async () => {
      createFile('package.json', '{"name":"test"}')
      createFile('package-lock.json', '{}')

      const { checkDependenciesInstalled } = await importRuntimeChecks()
      const result = await checkDependenciesInstalled(tmpDir)

      expect(result.status).toBe('fail')
      expect(result.message).toContain('Lockfile found')
    })

    it('passes when node_modules is present', async () => {
      createFile('package.json', '{"name":"test"}')
      createDir('node_modules')

      const { checkDependenciesInstalled } = await importRuntimeChecks()
      const result = await checkDependenciesInstalled(tmpDir)

      expect(result.status).toBe('pass')
    })

    it('warns when package.json is newer than lockfile', async () => {
      createFile('package.json', '{"name":"test"}')
      createFile('package-lock.json', '{}')
      createDir('node_modules')

      // Touch package.json after lockfile
      const pkgPath = path.join(tmpDir, 'package.json')
      const lockPath = path.join(tmpDir, 'package-lock.json')
      const now = new Date()
      fs.utimesSync(lockPath, now, now)
      const later = new Date(now.getTime() + 60000)
      fs.utimesSync(pkgPath, later, later)

      const { checkDependenciesInstalled } = await importRuntimeChecks()
      const result = await checkDependenciesInstalled(tmpDir)

      expect(result.status).toBe('warning')
      expect(result.message).toContain('out of sync')
    })
  })

  describe('checkProjectConfigFiles', () => {
    it('finds recognized config files', async () => {
      createFile('package.json', '{}')
      createFile('Makefile', 'all:\n\techo hi')

      const { checkProjectConfigFiles } = await importRuntimeChecks()
      const result = await checkProjectConfigFiles(tmpDir)

      expect(result.status).toBe('pass')
      expect(result.message).toContain('package.json')
      expect(result.message).toContain('Makefile')
    })

    it('warns when no config files are found', async () => {
      const { checkProjectConfigFiles } = await importRuntimeChecks()
      const result = await checkProjectConfigFiles(tmpDir)

      expect(result.status).toBe('warning')
      expect(result.suggestedFix).toContain('Initialize a project')
    })
  })

  describe('checkDockerComposePresent', () => {
    it('finds docker-compose.yml', async () => {
      createFile('docker-compose.yml', 'services:\n  web:\n    image: nginx')

      const { checkDockerComposePresent } = await importRuntimeChecks()
      const result = await checkDockerComposePresent(tmpDir)

      expect(result.status).toBe('pass')
      expect(result.message).toContain('docker-compose.yml')
    })

    it('finds compose.yml', async () => {
      createFile('compose.yml', 'services:\n  app:\n    build: .')

      const { checkDockerComposePresent } = await importRuntimeChecks()
      const result = await checkDockerComposePresent(tmpDir)

      expect(result.status).toBe('pass')
    })

    it('skips when no compose file is found', async () => {
      const { checkDockerComposePresent } = await importRuntimeChecks()
      const result = await checkDockerComposePresent(tmpDir)

      expect(result.status).toBe('skipped')
    })
  })

  describe('skipped checks', () => {
    it('checkPortsAvailable returns skipped', async () => {
      const { checkPortsAvailable } = await importRuntimeChecks()
      const result = await checkPortsAvailable(tmpDir)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('not yet implemented')
    })

    it('checkDatabaseReachable returns skipped', async () => {
      const { checkDatabaseReachable } = await importRuntimeChecks()
      const result = await checkDatabaseReachable(tmpDir)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('not yet implemented')
    })
  })

  describe('runRuntimeChecks', () => {
    it('runs all 6 checks and returns results', async () => {
      createFile('package.json', '{}')
      createFile('.env', 'FOO=bar')
      createDir('node_modules')

      const { runRuntimeChecks } = await importRuntimeChecks()
      const results = await runRuntimeChecks(tmpDir)

      expect(results.length).toBe(6)
      expect(results.every((r) => r.category === 'project')).toBe(true)

      const statuses = results.map((r) => `${r.key}=${r.status}`)
      // env-files should pass, dependencies should pass, config-files should pass,
      // docker-compose should be skipped, ports and database should be skipped
      expect(statuses).toContain('env-files=pass')
      expect(statuses).toContain('dependencies=pass')
      expect(statuses).toContain('config-files=pass')
    })
  })
})
