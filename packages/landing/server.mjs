#!/usr/bin/env node
/**
 * Static file server for the built landing page.
 *
 * Railway (decision 3 in docs/landing-page-plan.md) serves static output from a running
 * process rather than a CDN, so `npm start` must bind process.env.PORT on 0.0.0.0.
 * Zero dependencies on purpose: no extra install step in the deploy image.
 */
import { createReadStream, promises as fs } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(rootDir, 'dist')
const port = Number.parseInt(process.env.PORT ?? '4173', 10)
const host = process.env.HOST ?? '0.0.0.0'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

const IMMUTABLE_DIR = `${path.sep}assets${path.sep}`

/** Resolve a request path to a file inside dist, refusing traversal. */
async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const relative = decoded.replace(/^\/+/, '')
  const candidate = path.resolve(distDir, relative || 'index.html')

  if (candidate !== distDir && !candidate.startsWith(distDir + path.sep)) {
    return null
  }

  try {
    const stats = await fs.stat(candidate)
    if (stats.isDirectory()) {
      const indexFile = path.join(candidate, 'index.html')
      const indexStats = await fs.stat(indexFile)
      return indexStats.isFile() ? indexFile : null
    }
    return candidate
  } catch {
    return null
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed')
    return
  }

  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('ok')
    return
  }

  // Single-page site: unknown paths fall back to index.html.
  const file = (await resolveFile(req.url ?? '/')) ?? path.join(distDir, 'index.html')
  const ext = path.extname(file).toLowerCase()

  try {
    const stats = await fs.stat(file)
    res.writeHead(200, {
      'content-type': MIME_TYPES[ext] ?? 'application/octet-stream',
      'content-length': stats.size,
      'cache-control': file.includes(IMMUTABLE_DIR)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
      'x-content-type-options': 'nosniff',
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found')
  }
})

try {
  await fs.access(path.join(distDir, 'index.html'))
} catch {
  console.error(`[landing] Missing ${path.join(distDir, 'index.html')}. Run "npm run build" first.`)
  process.exit(1)
}

server.listen(port, host, () => {
  console.log(`[landing] serving ${distDir} on http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
