#!/usr/bin/env node
/**
 * Checks the landing page's committed media against its manifests.
 *
 *  - generated raster assets exist (npm run landing:assets)
 *  - vector logo files exist
 *  - every screenshot in src/config/screenshots.ts exists at exactly 1600x1000
 *
 * Usage:
 *   npm run landing:verify-assets            # report only, exit 0 (screenshots may be pending)
 *   npm run landing:verify-assets -- --strict  # exit 1 if anything is missing (use before ship)
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { Jimp } = require('jimp')

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(packageRoot, 'public')
const strict = process.argv.slice(2).includes('--strict')

const manifestPath = path.join(packageRoot, 'src', 'config', 'screenshots.ts')
const manifest = fs.readFileSync(manifestPath, 'utf8')
const expectedWidth = Number(manifest.match(/SCREENSHOT_WIDTH = (\d+)/)?.[1])
const expectedHeight = Number(manifest.match(/SCREENSHOT_HEIGHT = (\d+)/)?.[1])
// Match shot('id', ...) whether written on one line or split across lines.
const screenshotIds = [...manifest.matchAll(/shot\(\s*'([^']+)'/g)].map((m) => m[1])

if (!expectedWidth || !expectedHeight || screenshotIds.length === 0) {
  console.error(`[landing] could not parse ${path.relative(packageRoot, manifestPath)}`)
  process.exit(1)
}

const required = [
  'logo-mark.svg',
  'logo-mark-tile.svg',
  'favicon.ico',
  'favicon-32.png',
  'favicon-192.png',
  'favicon-512.png',
  'apple-touch-icon.png',
  'og-image.png',
  'site.webmanifest',
]

const missing = []
const wrongSize = []

for (const file of required) {
  const full = path.join(publicDir, file)
  if (fs.existsSync(full) && fs.statSync(full).size > 0) {
    console.log(`[landing] ok      ${file}`)
  } else {
    console.error(`[landing] MISSING ${file} — run "npm run landing:assets"`)
    missing.push(file)
  }
}

const og = path.join(publicDir, 'og-image.png')
if (fs.existsSync(og)) {
  const image = await Jimp.read(og)
  const { width, height } = image.bitmap
  if (width !== 1200 || height !== 630) {
    console.error(`[landing] SIZE    og-image.png is ${width}x${height}, expected 1200x630`)
    wrongSize.push('og-image.png')
  }
}

for (const id of screenshotIds) {
  const file = path.join(publicDir, 'screenshots', `${id}.png`)
  const rel = path.relative(publicDir, file).replace(/\\/g, '/')
  if (!fs.existsSync(file)) {
    console.error(`[landing] MISSING ${rel} — capture at ${expectedWidth}x${expectedHeight}`)
    missing.push(rel)
    continue
  }
  const image = await Jimp.read(file)
  const { width, height } = image.bitmap
  if (width !== expectedWidth || height !== expectedHeight) {
    console.error(
      `[landing] SIZE    ${rel} is ${width}x${height}, expected ${expectedWidth}x${expectedHeight}`,
    )
    wrongSize.push(rel)
  } else {
    console.log(`[landing] ok      ${rel} (${width}x${height})`)
  }
}

const problems = missing.length + wrongSize.length
if (problems === 0) {
  console.log('\n[landing] all landing assets present and correctly sized.')
  process.exit(0)
}

console.error(
  `\n[landing] ${missing.length} missing, ${wrongSize.length} mis-sized.` +
    (strict ? '' : '\n[landing] non-strict run: exiting 0. Use --strict before shipping.'),
)
process.exit(strict ? 1 : 0)
