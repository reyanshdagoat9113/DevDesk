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
// In-app logo tile (same rounded mark) bundled by the renderer.
const appIconOut = path.join(repoRoot, 'apps', 'renderer', 'assets', 'devdesk-icon.png')

/**
 * Scan a region and return the tight bounding box of pixels that differ from
 * the background color (i.e. the logo mark itself).
 */
function detectBoundingBox(img, region, bg, threshold) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1

  for (let y = region.y0; y < region.y1; y++) {
    for (let x = region.x0; x < region.x1; x++) {
      const c = img.getPixelColor(x, y)
      const r = (c >>> 24) & 255
      const g = (c >>> 16) & 255
      const b = (c >>> 8) & 255
      const diff = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b)
      if (diff > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) {
    throw new Error('Could not detect the logo mark within the source artwork.')
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * Make the corners of a square image transparent with a rounded-rectangle mask,
 * anti-aliased for smooth edges.
 */
function roundCorners(img, radius) {
  const { width, height } = img.bitmap

  img.scan(0, 0, width, height, (x, y, idx) => {
    // Distance the pixel sits inside each corner's rounding circle.
    let cx = null
    let cy = null
    if (x < radius && y < radius) {
      cx = radius
      cy = radius
    } else if (x >= width - radius && y < radius) {
      cx = width - radius - 1
      cy = radius
    } else if (x < radius && y >= height - radius) {
      cx = radius
      cy = height - radius - 1
    } else if (x >= width - radius && y >= height - radius) {
      cx = width - radius - 1
      cy = height - radius - 1
    }

    if (cx === null) return

    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    // 1px feather band for smooth (anti-aliased) corner edges.
    const alpha = dist <= radius - 1 ? 1 : dist >= radius ? 0 : radius - dist
    img.bitmap.data[idx + 3] = Math.round(img.bitmap.data[idx + 3] * alpha)
  })
}

async function main() {
  fs.mkdirSync(buildDir, { recursive: true })

  if (!fs.existsSync(sourceLogo)) {
    throw new Error(`Logo source not found: ${sourceLogo}`)
  }

  // The source is a 3x2 grid of logo options. We use ONLY the chosen
  // top-left logo mark (the "D" with a terminal prompt and green cursor),
  // excluding the "DevDesk" wordmark below it.
  //
  // Region of the top-left cell that contains the mark (text lives below
  // ~y=262, and the neighbouring cell begins near x=500).
  const CELL = { x0: 0, y0: 0, x1: 500, y1: 262 }
  // Background color of the source artwork (rgb(11, 17, 40) => #0b1128).
  const BG = { r: 11, g: 17, b: 40, a: 255 }
  const OUTPUT = 512
  const PADDING = 0.16 // fraction of the output reserved as margin around the mark
  const CORNER_RADIUS = Math.round(OUTPUT * 0.11) // slight, smooth rounding

  const src = await Jimp.read(sourceLogo)

  // Auto-detect the tight bounding box of the mark so it is perfectly centered
  // regardless of the source artwork's own alignment.
  const bbox = detectBoundingBox(src, CELL, BG, 45)
  const mark = src.clone().crop({ x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h })

  // Scale the mark to fit within the padded area while preserving aspect ratio.
  const inner = Math.round(OUTPUT * (1 - PADDING * 2))
  const scale = Math.min(inner / bbox.w, inner / bbox.h)
  mark.resize({ w: Math.round(bbox.w * scale), h: Math.round(bbox.h * scale) })

  const canvas = new Jimp({
    width: OUTPUT,
    height: OUTPUT,
    color: (BG.r << 24) | (BG.g << 16) | (BG.b << 8) | BG.a,
  })
  canvas.composite(
    mark,
    Math.round((OUTPUT - mark.bitmap.width) / 2),
    Math.round((OUTPUT - mark.bitmap.height) / 2),
  )

  roundCorners(canvas, CORNER_RADIUS)
  await canvas.write(pngOut)

  // Reuse the same rounded tile as the in-app logo shown in the sidebar.
  await canvas.clone().write(appIconOut)

  fs.writeFileSync(icoOut, await pngToIco(pngOut))

  if (!fs.existsSync(icoOut) || fs.statSync(icoOut).size < 100) {
    throw new Error(`Failed to write Windows icon: ${icoOut}`)
  }

  console.log(
    `Wrote ${path.relative(repoRoot, pngOut)}, ${path.relative(repoRoot, icoOut)}, and ${path.relative(repoRoot, appIconOut)}`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
