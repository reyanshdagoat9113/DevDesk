#!/usr/bin/env node
/**
 * Generates the landing page's raster assets from the product icon.
 *
 * Inputs:  build/icon.png (produced by scripts/generate-app-icons.mjs)
 * Outputs: public/favicon.ico, favicon-32.png, favicon-192.png, favicon-512.png,
 *          apple-touch-icon.png, og-image.png (1200x630)
 *
 * Usage: npm run landing:assets
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { Jimp, loadFont } = require('jimp')
const { SANS_64_WHITE, SANS_32_WHITE } = require('jimp/fonts')
const pngToIco = require('png-to-ico')

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const sourceIcon = path.join(repoRoot, 'build', 'icon.png')
const publicDir = path.join(packageRoot, 'public')

// Product icon background, sampled from build/icon.png.
const TILE_BG = { r: 11, g: 17, b: 40 }
const rgba = ({ r, g, b }, a = 255) => (r << 24) | (g << 16) | (b << 8) | a

async function main() {
  if (!fs.existsSync(sourceIcon)) {
    throw new Error(`Missing ${path.relative(repoRoot, sourceIcon)}. Run "npm run icons:generate" first.`)
  }
  fs.mkdirSync(publicDir, { recursive: true })

  const icon = await Jimp.read(sourceIcon)
  const written = []

  // Favicons and the iOS home-screen icon.
  for (const size of [32, 192, 512]) {
    const out = path.join(publicDir, `favicon-${size}.png`)
    await icon.clone().resize({ w: size, h: size }).write(out)
    written.push(out)
  }

  const appleTouch = path.join(publicDir, 'apple-touch-icon.png')
  await icon.clone().resize({ w: 180, h: 180 }).write(appleTouch)
  written.push(appleTouch)

  // Multi-size .ico from small renditions only: a 256px source balloons the file.
  const icoSources = []
  for (const size of [16, 32, 48]) {
    const tmp = path.join(publicDir, `.favicon-${size}.tmp.png`)
    await icon.clone().resize({ w: size, h: size }).write(tmp)
    icoSources.push(tmp)
  }
  const icoPath = path.join(publicDir, 'favicon.ico')
  fs.writeFileSync(icoPath, await pngToIco(icoSources))
  icoSources.forEach((file) => fs.rmSync(file))
  written.push(icoPath)

  // Open Graph / Twitter card: 1200x630, icon on the left, type on the right.
  const OG_W = 1200
  const OG_H = 630
  const og = new Jimp({ width: OG_W, height: OG_H, color: rgba(TILE_BG) })

  // Faint horizontal rule so the card is not a flat rectangle.
  og.scan(0, OG_H - 6, OG_W, 6, (_x, _y, idx) => {
    og.bitmap.data[idx] = 0x33
    og.bitmap.data[idx + 1] = 0xd0
    og.bitmap.data[idx + 2] = 0x2b
    og.bitmap.data[idx + 3] = 255
  })

  const mark = icon.clone().resize({ w: 220, h: 220 })
  og.composite(mark, 96, Math.round((OG_H - 220) / 2))

  const titleFont = await loadFont(SANS_64_WHITE)
  const bodyFont = await loadFont(SANS_32_WHITE)
  const textLeft = 96 + 220 + 64
  const textWidth = OG_W - textLeft - 96

  og.print({ font: titleFont, x: textLeft, y: 200, text: 'DevDesk' })
  og.print({
    font: bodyFont,
    x: textLeft,
    y: 296,
    text: 'Projects, command vault, Docker controls, terminals, and local code search in one workspace.',
    maxWidth: textWidth,
  })
  og.print({ font: bodyFont, x: textLeft, y: 414, text: 'Local-first. No account. No telemetry.' })

  const ogPath = path.join(publicDir, 'og-image.png')
  await og.write(ogPath)
  written.push(ogPath)

  for (const file of written) {
    console.log(`[landing] wrote ${path.relative(repoRoot, file)} (${fs.statSync(file).size} bytes)`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
