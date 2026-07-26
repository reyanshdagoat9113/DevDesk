#!/usr/bin/env node
/**
 * Verifies download artifact URLs against the flags in src/config/site.ts.
 *
 *  - Every artifact marked available: true must resolve (HTTP 2xx/3xx).
 *  - Every artifact marked available: false that *does* resolve is reported as a reminder
 *    to flip its flag.
 *
 * Usage: npm run landing:verify-downloads
 * Exit 1 only when a claimed-available asset is missing.
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configPath = path.join(rootDir, 'src', 'config', 'site.ts')
const source = await fs.readFile(configPath, 'utf8')

const owner = source.match(/GITHUB_OWNER = '([^']+)'/)?.[1]
const repo = source.match(/GITHUB_REPO = '([^']+)'/)?.[1]
const version = source.match(/APP_VERSION = '([^']+)'/)?.[1]

if (!owner || !repo || !version) {
  console.error(`[landing] could not parse download config from ${configPath}`)
  process.exit(1)
}

const tag = `v${version}`
const blocks = source.split(/\{\s*\n\s*id:/).slice(1)
const artifacts = []

for (const block of blocks) {
  const id = block.match(/^\s*'([^']+)'/)?.[1]
  const fileName = block.match(/fileName:\s*`DevDesk-\$\{APP_VERSION\}-([^`]+)`/)?.[1]
  const available = /available:\s*true/.test(block)
  if (!id || !fileName) continue
  artifacts.push({
    id,
    fileName: `DevDesk-${version}-${fileName}`,
    available,
  })
}

if (artifacts.length === 0) {
  console.error('[landing] no download artifacts found in site.ts')
  process.exit(1)
}

let claimedMissing = 0
let unclaimedLive = 0

for (const artifact of artifacts) {
  const url = `https://github.com/${owner}/${repo}/releases/download/${tag}/${artifact.fileName}`
  let status = 0
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    status = response.status
  } catch (error) {
    if (artifact.available) {
      console.error(`[landing] FAIL ${artifact.fileName} — ${error.message}`)
      claimedMissing += 1
    } else {
      console.log(`[landing] wait ${artifact.fileName} — unreachable (flag=false)`)
    }
    continue
  }

  const live = status >= 200 && status < 400
  if (artifact.available && live) {
    console.log(`[landing] ok   ${artifact.fileName}`)
  } else if (artifact.available && !live) {
    console.error(`[landing] FAIL ${artifact.fileName} — HTTP ${status} (flag=true)`)
    claimedMissing += 1
  } else if (!artifact.available && live) {
    console.log(
      `[landing] LIVE ${artifact.fileName} — asset is up; set available: true for '${artifact.id}'`,
    )
    unclaimedLive += 1
  } else {
    console.log(`[landing] wait ${artifact.fileName} — HTTP ${status} (flag=false)`)
  }
}

if (claimedMissing > 0) {
  console.error(
    `\n[landing] ${claimedMissing} claimed-available asset(s) unreachable for ${tag}.` +
      `\n[landing] Either upload them or set available: false on the matching entries.`,
  )
  process.exit(1)
}

console.log(
  `\n[landing] claims hold for ${tag}.` +
    (unclaimedLive > 0
      ? ` ${unclaimedLive} live asset(s) still flagged unavailable.`
      : ' All live flags match reality.'),
)
