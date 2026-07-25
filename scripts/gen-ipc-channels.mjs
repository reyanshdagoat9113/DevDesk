import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const preload = fs.readFileSync(path.join(root, 'apps/desktop/preload.ts'), 'utf8')
const main = fs.readFileSync(path.join(root, 'apps/desktop/ipc/registerIpc.ts'), 'utf8')

const inv = [...preload.matchAll(/invoke\('([^']+)'/g)].map((m) => m[1])
const on = [...preload.matchAll(/\.on\('([^']+)'/g)].map((m) => m[1])
const h = [...main.matchAll(/ipcMain\.handle\('([^']+)'/g)].map((m) => m[1])

const allInvoke = [...new Set([...inv, ...h])].sort()
const allEvents = [...new Set(on)].sort()

function toKey(ch) {
  return ch
    .split(/[:.-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
}

const lines = []
lines.push('/** Shared IPC channel constants. Runtime-neutral: no Electron imports. */')
lines.push('')
lines.push(`export const IPC_INVOKE_CHANNELS = ${JSON.stringify(allInvoke, null, 2)} as const`)
lines.push('')
lines.push('export type IpcInvokeChannel = (typeof IPC_INVOKE_CHANNELS)[number]')
lines.push('')
lines.push(`export const IPC_EVENT_CHANNELS = ${JSON.stringify(allEvents, null, 2)} as const`)
lines.push('')
lines.push('export type IpcEventChannel = (typeof IPC_EVENT_CHANNELS)[number]')
lines.push('')
lines.push('export const IpcChannels = {')
for (const c of allInvoke) {
  lines.push(`  ${JSON.stringify(toKey(c))}: ${JSON.stringify(c)} as IpcInvokeChannel,`)
}
for (const c of allEvents) {
  lines.push(`  ${JSON.stringify(`On${toKey(c)}`)}: ${JSON.stringify(c)} as IpcEventChannel,`)
}
lines.push('} as const')
lines.push('')
lines.push(`export const SAFE_EXTERNAL_URL_SCHEMES = ['https:', 'http:'] as const`)
lines.push('')
lines.push(`export function isSafeExternalUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    if (!(SAFE_EXTERNAL_URL_SCHEMES as readonly string[]).includes(parsed.protocol)) {
      return false
    }
    if (
      parsed.protocol === 'http:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1' &&
      parsed.hostname !== '[::1]'
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}
`)

const outDir = path.join(root, 'packages/ipc-contracts/src')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'channels.ts'), `${lines.join('\n')}\n`)
fs.writeFileSync(path.join(outDir, 'index.ts'), "export * from './channels'\n")
console.log(`Wrote ${allInvoke.length} invoke + ${allEvents.length} event channels`)
