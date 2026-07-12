/**
 * Generate electron-builder icon assets from the product logo.
 * Produces build/icon.png (512) and build/icon.ico (Windows).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Jimp } = require('jimp')
const pngToIco = require('png-to-ico')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(repoRoot, 'build')
const sourceLogo = path.join(repoRoot, 'apps', 'renderer', 'assets', 'devdesk-logo-options.png')
const pngOut = path.join(buildDir, 'icon.png')
const icoOut = path.join(buildDir, 'icon.ico')

async function main() {
  fs.mkdirSync(buildDir, { recursive: true })

  if (!fs.existsSync(sourceLogo)) {
    throw new Error(`Logo source not found: ${sourceLogo}`)
  }

  const src = await Jimp.read(sourceLogo)
  const size = Math.min(src.bitmap.width, src.bitmap.height)
  const x = Math.floor((src.bitmap.width - size) / 2)
  const y = Math.floor((src.bitmap.height - size) / 2)
  src.crop({ x, y, w: size, h: size })
  src.resize({ w: 512, h: 512 })
  await src.write(pngOut)

  fs.writeFileSync(icoOut, await pngToIco(pngOut))

  if (!fs.existsSync(icoOut) || fs.statSync(icoOut).size < 100) {
    throw new Error(`Failed to write Windows icon: ${icoOut}`)
  }

  console.log(`Wrote ${path.relative(repoRoot, pngOut)} and ${path.relative(repoRoot, icoOut)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
