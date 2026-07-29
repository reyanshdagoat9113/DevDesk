import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'
import {
  IPC_EVENT_CHANNELS,
  IPC_INVOKE_CHANNELS,
  IpcChannels,
  isSafeExternalUrl,
} from '@devdesk/ipc-contracts'

const repoRoot = path.resolve(__dirname, '../../..')

function extractInvokeChannels(source: string): string[] {
  return [...source.matchAll(/invoke\('([^']+)'/g)].map((m) => m[1])
}

function extractHandleChannels(source: string): string[] {
  const quoted = [...source.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((m) => m[1])
  const constRefs = [...source.matchAll(/ipcMain\.handle\(\s*IpcChannels\.(\w+)/g)].map((m) => {
    const key = m[1] as keyof typeof IpcChannels
    return IpcChannels[key] as string
  })
  return [...quoted, ...constRefs]
}

function extractEventChannels(source: string): string[] {
  return [...source.matchAll(/\.on\('([^']+)'/g)].map((m) => m[1])
}

describe('shared IPC contracts', () => {
  it('keeps preload invoke channels covered by the shared authority', () => {
    const preload = fs.readFileSync(path.join(repoRoot, 'apps/desktop/preload.ts'), 'utf8')
    const preloadChannels = new Set(extractInvokeChannels(preload))
    const authority = new Set<string>(IPC_INVOKE_CHANNELS)
    for (const channel of preloadChannels) {
      assert.ok(authority.has(channel), `preload invoke missing from authority: ${channel}`)
    }
  })

  it('keeps main handle channels covered by the shared authority', () => {
    const main = fs.readFileSync(path.join(repoRoot, 'apps/desktop/ipc/registerIpc.ts'), 'utf8')
    const mainChannels = new Set(extractHandleChannels(main))
    const authority = new Set<string>(IPC_INVOKE_CHANNELS)
    for (const channel of mainChannels) {
      assert.ok(authority.has(channel), `main handle missing from authority: ${channel}`)
    }
  })

  it('has no duplicate invoke channel constants', () => {
    assert.equal(new Set(IPC_INVOKE_CHANNELS).size, IPC_INVOKE_CHANNELS.length)
    assert.equal(new Set(IPC_EVENT_CHANNELS).size, IPC_EVENT_CHANNELS.length)
  })

  it('covers preload event subscriptions', () => {
    const preload = fs.readFileSync(path.join(repoRoot, 'apps/desktop/preload.ts'), 'utf8')
    const events = new Set(extractEventChannels(preload))
    const authority = new Set<string>(IPC_EVENT_CHANNELS)
    for (const channel of events) {
      assert.ok(authority.has(channel), `event missing from authority: ${channel}`)
    }
  })

  it('rejects unsafe external URL schemes', () => {
    assert.equal(isSafeExternalUrl('https://example.com'), true)
    assert.equal(isSafeExternalUrl('http://localhost:3000/x'), true)
    assert.equal(isSafeExternalUrl('http://evil.example'), false)
    assert.equal(isSafeExternalUrl('file:///etc/passwd'), false)
    assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
    assert.equal(isSafeExternalUrl(''), false)
  })
})
