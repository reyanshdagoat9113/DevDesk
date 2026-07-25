/**
 * Back-compat wrapper. Prefer: node scripts/verify-package.mjs --platform linux
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-package.mjs')
const result = spawnSync(process.execPath, [script, '--platform', 'linux'], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
