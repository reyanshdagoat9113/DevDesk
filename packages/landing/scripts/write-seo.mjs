#!/usr/bin/env node
/**
 * Writes public/sitemap.xml with an absolute origin.
 * Origin: VITE_SITE_URL env, else the GitHub repo URL (never a bare relative path).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origin = (process.env.VITE_SITE_URL || 'https://github.com/reyanshdagoat9113/DevDesk').replace(
  /\/$/,
  '',
)

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

const robots = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`

fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), sitemap)
fs.writeFileSync(path.join(root, 'public', 'robots.txt'), robots)
console.log(`[landing] SEO files written for origin ${origin}`)
