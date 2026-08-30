import { spawn, type ChildProcess } from 'node:child_process'

/**
 * Extra spawn options for command-vault runs so Stop can kill the whole tree.
 * POSIX: detached so the shell is a process-group leader (`kill(-pid)`).
 * Windows: not detached — Stop uses `taskkill /T` instead.
 */
export function commandSpawnOptions(): { detached: boolean } {
  return { detached: process.platform !== 'win32' }
}

/**
 * Best-effort kill of a spawned command and its descendants.
 * Never throws — spawn/kill failures are swallowed after a fallback to `child.kill()`.
 */
export async function killProcessTree(
  child: ChildProcess,
  signal?: NodeJS.Signals
): Promise<void> {
  const pid = child.pid
  if (pid === undefined || pid <= 0) {
    return
  }

  if (process.platform === 'win32') {
    await killWindowsProcessTree(child, pid)
    return
  }

  const sig = signal ?? 'SIGTERM'
  try {
    process.kill(-pid, sig)
  } catch {
    try {
      child.kill(sig)
    } catch {
      // best-effort
    }
  }
}

function killWindowsProcessTree(child: ChildProcess, pid: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const fallbackKill = () => {
      try {
        child.kill()
      } catch {
        // best-effort
      }
      finish()
    }

    try {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      killer.once('error', fallbackKill)
      killer.once('close', finish)
    } catch {
      fallbackKill()
    }
  })
}
