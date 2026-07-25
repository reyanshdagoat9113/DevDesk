#!/usr/bin/env node
/**
 * Verifies that every artifact URL in src/config/site.ts resolves before the download
 * section is allowed to claim it exists (risk 2 in docs/landing-page-plan.md).
 *
 * Usage: npm run landing:verify-downloads
 * Exit 0 = every asset reachable. Exit 1 = at least one missing.
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
const published = /releasePublished = (true|false)/.exec(source)?.[1] === 'true'
const fileNames = [...source.matchAll(/fileName: `DevDesk-\$\{APP_VERSION\}-([^`]+)`/g)].map(
  (match) => `DevDesk-${version}-${match[1]}`,
)

if (!owner || !repo || !version || fileNames.length === 0) {
  console.error(`[landing] could not parse download config from ${configPath}`)
  process.exit(1)
}

const tag = `v${version}`
const failures = []

for (const fileName of fileNames) {
  const url = `https://github.com/${owner}/${repo}/releases/download/${tag}/${fileName}`
  let status = 0
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    status = response.status
  } catch (error) {
    console.error(`[landing] FAIL ${fileName} — ${error.message}`)
    failures.push(fileName)
    continue
  }

  if (status >= 200 && status < 400) {
    console.log(`[landing] ok   ${fileName}`)
  } else {
    console.error(`[landing] FAIL ${fileName} — HTTP ${status}`)
    failures.push(fileName)
  }
}

if (failures.length > 0) {
  console.error(
    `\n[landing] ${failures.length}/${fileNames.length} asset(s) unreachable for ${tag}.` +
      `\n[landing] Publish the release, then set releasePublished = true in src/config/site.ts.`,
  )
  process.exit(1)
}

console.log(`\n[landing] all ${fileNames.length} asset(s) reachable for ${tag}.`)
if (!published) {
  console.log('[landing] reminder: set releasePublished = true in src/config/site.ts.')
}
