/**
 * Run the documented release gate with labeled steps for CI logs.
 *
 * Usage: node scripts/release-gate.mjs
 * Optional env:
 *   DEVDESK_GATE_SKIP_ENGINE_BUILD=1  — skip engine rust build (not for CI)
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmCli =
  process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

const steps = [
  { name: 'typecheck', args: ['run', 'typecheck'] },
  { name: 'lint', args: ['run', 'lint'] },
  { name: 'lint:architecture', args: ['run', 'lint:architecture'] },
  { name: 'test:run', args: ['run', 'test:run'] },
  { name: 'test:renderer:run', args: ['run', 'test:renderer:run'] },
  { name: 'test:engine-ipc', args: ['run', 'test:engine-ipc'] },
  { name: 'smoke:engine-packaged', args: ['run', 'smoke:engine-packaged'] },
]

function runStep(step) {
  console.log(`\n==> release-gate: ${step.name}\n`)
  const result = spawnSync(process.execPath, [npmCli, ...step.args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    console.error(`\nrelease-gate failed at step: ${step.name} (exit ${result.status ?? 1})`)
    process.exit(result.status ?? 1)
  }
}

for (const step of steps) {
  runStep(step)
}

console.log('\nrelease-gate: all baseline steps passed.\n')
