/**
 * Engine Binary Management
 * Handles locating and spawning the devdesk-engine binary
 */

import { fork, spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import type {
  EngineGitInsights,
  EngineIndexResult,
  EngineSearchResult,
  EngineStats,
  EngineStatus,
} from './types'
import {
  buildEngineGitArgs,
  buildEngineIndexArgs,
  buildEngineSearchArgs,
  buildEngineStatsArgs,
  getEngineDbPathFromUserData,
  resolveEngineBinaryPath,
} from './runtime'

// Get the path to the engine CLI (Node.js script that calls Rust binary)
function getEngineBinaryPath(): string {
  return resolveEngineBinaryPath({
    appPath: app.getAppPath(),
    moduleDirname: __dirname,
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    existsSync: fs.existsSync,
  })
}

/**
 * Check if the engine is available
 */
export async function getEngineStatus(): Promise<EngineStatus> {
  const enginePath = getEngineBinaryPath()

  if (!fs.existsSync(enginePath)) {
    return {
      available: false,
      error: 'Engine binary not found',
    }
  }

  try {
    const result = await runEngineCommand(['--version'])
    return {
      available: true,
      version: result.trim(),
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get database path for a project
 */
export function getEngineDbPath(projectId: string): string {
  return getEngineDbPathFromUserData(app.getPath('userData'), projectId)
}

/**
 * Run an engine command and return the parsed JSON result
 */
async function runEngineCommand(args: string[]): Promise<string> {
  const enginePath = getEngineBinaryPath()

  return new Promise((resolve, reject) => {
    const child =
      path.extname(enginePath).toLowerCase() === '.js'
        ? fork(enginePath, args, {
            execPath: process.execPath,
            silent: true,
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: '1',
            },
          })
        : spawn(enginePath, args, {
            windowsHide: true,
            env: {
              ...process.env,
            },
          })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err: Error) => {
      reject(err)
    })

    child.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Engine exited with code ${code}`))
      }
    })
  })
}

/**
 * Index a project
 */
export async function engineIndex(
  projectPath: string,
  projectId: string
): Promise<EngineIndexResult> {
  const dbPath = getEngineDbPath(projectId)
  const result = await runEngineCommand(buildEngineIndexArgs(projectPath, dbPath))
  return JSON.parse(result) as EngineIndexResult
}

/**
 * Search a project
 */
export async function engineSearch(
  projectId: string,
  query: string,
  options?: {
    regex?: boolean
    limit?: number
  }
): Promise<EngineSearchResult> {
  const dbPath = getEngineDbPath(projectId)
  const result = await runEngineCommand(buildEngineSearchArgs(query, dbPath, options))
  return JSON.parse(result) as EngineSearchResult
}

/**
 * Get project stats
 */
export async function engineStats(projectId: string): Promise<EngineStats> {
  const dbPath = getEngineDbPath(projectId)
  const result = await runEngineCommand(buildEngineStatsArgs(dbPath))
  return JSON.parse(result) as EngineStats
}

export async function engineGit(projectPath: string): Promise<EngineGitInsights> {
  const result = await runEngineCommand(buildEngineGitArgs(projectPath))
  const parsed = JSON.parse(result) as EngineGitInsights & { ok?: boolean; error?: string }

  if ('ok' in parsed && parsed.ok === false) {
    throw new Error(parsed.error || 'Failed to load git insights.')
  }

  return parsed
}

export type {
  EngineGitInsights,
  EngineIndexResult,
  EngineSearchResult,
  EngineStats,
  EngineStatus,
} from './types'
