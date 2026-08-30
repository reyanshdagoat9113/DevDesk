import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { commandSpawnOptions, killProcessTree } from './processTree'

const PARENT_SCRIPT =
  "const {spawn}=require('child_process');const fs=require('fs');const child=spawn(process.execPath,['-e',process.env.DD_GC_SCRIPT],{env:process.env,stdio:'ignore'});fs.writeFileSync(process.env.DD_PID,String(child.pid));setInterval(function(){},1000);"

const GRANDCHILD_SCRIPT =
  "const fs=require('fs');function beat(){fs.writeFileSync(process.env.DD_HB,String(Date.now()));}beat();setInterval(beat,100);"

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 50): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out after ${timeoutMs}ms`)
}

describe('killProcessTree', () => {
  let parent: ChildProcess | undefined
  let grandchildPid: number | undefined
  const tmpFiles: string[] = []

  afterEach(async () => {
    if (parent) {
      try {
        await killProcessTree(parent)
      } catch {
        // cleanup
      }
      parent = undefined
    }
    if (grandchildPid !== undefined) {
      try {
        process.kill(grandchildPid)
      } catch {
        // already gone
      }
      grandchildPid = undefined
    }
    for (const file of tmpFiles.splice(0)) {
      try {
        fs.unlinkSync(file)
      } catch {
        // already gone
      }
    }
  })

  it('does not throw when child pid is missing', async () => {
    const child = { pid: undefined } as ChildProcess
    await expect(killProcessTree(child)).resolves.toBeUndefined()
  })

  it('does not throw when the process has already exited', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], {
      stdio: 'ignore',
      ...commandSpawnOptions(),
    })
    await new Promise<void>((resolve, reject) => {
      child.once('close', () => resolve())
      child.once('error', reject)
    })
    await expect(killProcessTree(child)).resolves.toBeUndefined()
  })

  it(
    'kills the parent shell and its grandchild',
    async () => {
      const id = randomUUID()
      const heartbeatPath = path.join(os.tmpdir(), `devdesk-pt-hb-${id}`)
      const pidPath = path.join(os.tmpdir(), `devdesk-pt-pid-${id}`)
      tmpFiles.push(heartbeatPath, pidPath)

      const command = 'node -e "eval(process.env.DD_PARENT_SCRIPT)"'
      parent = spawn(command, {
        shell: true,
        env: {
          ...process.env,
          DD_PARENT_SCRIPT: PARENT_SCRIPT,
          DD_GC_SCRIPT: GRANDCHILD_SCRIPT,
          DD_HB: heartbeatPath,
          DD_PID: pidPath,
        },
        ...commandSpawnOptions(),
      })
      parent.stdout?.resume()
      parent.stderr?.resume()

      const parentPid = parent.pid
      expect(parentPid).toBeGreaterThan(0)

      await waitUntil(
        () => fs.existsSync(pidPath) && Number(fs.readFileSync(pidPath, 'utf8').trim()) > 0,
        8000
      )
      grandchildPid = Number(fs.readFileSync(pidPath, 'utf8').trim())
      expect(grandchildPid).toBeGreaterThan(0)

      await waitUntil(() => fs.existsSync(heartbeatPath), 8000)
      expect(isPidAlive(grandchildPid)).toBe(true)

      await killProcessTree(parent)

      await waitUntil(() => !isPidAlive(grandchildPid!), 8000)
      await waitUntil(() => !isPidAlive(parentPid!), 8000)

      const heartbeatBefore = fs.readFileSync(heartbeatPath, 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 300))
      const heartbeatAfter = fs.readFileSync(heartbeatPath, 'utf8')
      expect(heartbeatAfter).toBe(heartbeatBefore)
    },
    15000
  )
})
