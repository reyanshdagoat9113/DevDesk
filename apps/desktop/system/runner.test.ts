import { describe, expect, it } from 'vitest'
import { runSystemCheck, TRUNCATION_MARKER } from './runner'
import type { SystemCheckResult } from './runner'

describe('runSystemCheck', () => {
  it('returns ok:true for successful command (exit 0)', async () => {
    const result = await runSystemCheck('node', ['-e', 'console.log("hello")'])
    expect(result.ok).toBe(true)
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('hello')
  })

  it('returns ok:false for non-zero exit', async () => {
    const result = await runSystemCheck('node', ['-e', 'process.exit(3)'])
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
  })

  it('captures stderr separately', async () => {
    const result = await runSystemCheck('node', ['-e', 'console.error("err msg")'])
    expect(result.ok).toBe(true)
    expect(result.stderr).toContain('err msg')
  })

  it('captures both stdout and stderr', async () => {
    const result = await runSystemCheck('node', [
      '-e',
      'console.log("out"); console.error("err")',
    ])
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('out')
    expect(result.stderr).toContain('err')
  })

  it('returns spawn error for nonexistent command', async () => {
    const result = await runSystemCheck('nonexistent_cmd_xyz_123', [])
    expect(result.ok).toBe(false)
  })

  it('times out long-running command', async () => {
    const result = await runSystemCheck(
      'node',
      ['-e', 'setTimeout(() => {}, 120000)'],
      { timeout: 1500 }
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(null)
    expect(result.stderr).toContain('timed out')
  })

  it('succeeds when timeout is 0 (disabled)', async () => {
    const result = await runSystemCheck(
      'node',
      ['-e', 'console.log("no-timeout")'],
      { timeout: 0 }
    )
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('no-timeout')
  })

  it('succeeds when timeout is Infinity (disabled)', async () => {
    const result = await runSystemCheck(
      'node',
      ['-e', 'console.log("infinite")'],
      { timeout: Infinity }
    )
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('infinite')
  })

  it('does not time out fast command', async () => {
    const result = await runSystemCheck(
      'node',
      ['-e', 'console.log("fast")'],
      { timeout: 3000 }
    )
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('fast')
  })

  it('does not fire SIGKILL on a process that already exited', async () => {
    const result = await runSystemCheck(
      'node',
      ['-e', 'console.log("quick-exit")'],
      { timeout: 5000 }
    )
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('quick-exit')
  })

  it('truncates stdout at maxBuffer', async () => {
    // Generate ~2000 chars of output
    const chars = 2000
    const result = await runSystemCheck(
      'node',
      ['-e', `console.log("${'x'.repeat(chars)}")`],
      { maxBuffer: 1000 }
    )
    expect(result.ok).toBe(true)
    expect(result.stdout.endsWith(TRUNCATION_MARKER)).toBe(true)
    expect(result.stdout.length).toBeLessThanOrEqual(1000 + TRUNCATION_MARKER.length)
  })

  it('truncates stderr at maxBuffer', async () => {
    const chars = 2000
    const result = await runSystemCheck(
      'node',
      ['-e', `console.error("${'x'.repeat(chars)}")`],
      { maxBuffer: 1000 }
    )
    expect(result.ok).toBe(true)
    expect(result.stderr.endsWith(TRUNCATION_MARKER)).toBe(true)
    expect(result.stderr.length).toBeLessThanOrEqual(1000 + TRUNCATION_MARKER.length)
  })

  it('handles special characters (Unicode)', async () => {
    const result = await runSystemCheck('node', [
      '-e',
      'console.log("café résumé naïve")',
    ])
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('café')
    expect(result.stdout).toContain('résumé')
    expect(result.stdout).toContain('naïve')
  })

  it('strips null bytes from output', async () => {
    const result = await runSystemCheck('node', [
      '-e',
      'process.stdout.write("hello\\x00world")',
    ])
    expect(result.ok).toBe(true)
    expect(result.stdout).not.toContain('\x00')
    expect(result.stdout).toContain('hello')
    expect(result.stdout).toContain('world')
  })

  it('handles large number of args', async () => {
    const result = await runSystemCheck('node', [
      '-e',
      'console.log(process.argv.slice(1).join(","))',
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
    ])
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('a,b,c,d,e,f,g,h,i,j')
  })

  it('resolves for empty args (no args)', async () => {
    const result = await runSystemCheck('node', ['-e', ''])
    expect(result.ok).toBe(true)
    expect(result.code).toBe(0)
  })
})
