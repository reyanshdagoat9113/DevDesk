import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'vitest'
import { isAllowedNavigation } from './navigationGuard'

const indexHtmlPath = path.resolve('/app/dist/renderer/index.html')

describe('isAllowedNavigation', () => {
  it('allows the packaged app index.html file URL in production', () => {
    const url = pathToFileURL(indexHtmlPath).href
    assert.equal(
      isAllowedNavigation(url, { isDev: false, indexHtmlPath }),
      true,
    )
  })

  it('denies a different file: URL in production', () => {
    const other = pathToFileURL(path.resolve('/tmp/evil.html')).href
    assert.equal(
      isAllowedNavigation(other, { isDev: false, indexHtmlPath }),
      false,
    )
  })

  it('denies http URLs in production', () => {
    assert.equal(
      isAllowedNavigation('http://127.0.0.1:5180/', { isDev: false, indexHtmlPath }),
      false,
    )
    assert.equal(
      isAllowedNavigation('https://example.com', { isDev: false, indexHtmlPath }),
      false,
    )
  })

  it('allows the Vite dev origin and denies other hosts in development', () => {
    assert.equal(
      isAllowedNavigation('http://127.0.0.1:5180/', { isDev: true, indexHtmlPath }),
      true,
    )
    assert.equal(
      isAllowedNavigation('http://localhost:5180/main.tsx', { isDev: true, indexHtmlPath }),
      true,
    )
    assert.equal(
      isAllowedNavigation('http://127.0.0.1:3000/', { isDev: true, indexHtmlPath }),
      false,
    )
    assert.equal(
      isAllowedNavigation('http://evil.example/', { isDev: true, indexHtmlPath }),
      false,
    )
    assert.equal(
      isAllowedNavigation(pathToFileURL(indexHtmlPath).href, { isDev: true, indexHtmlPath }),
      false,
    )
  })

  it('denies invalid URLs', () => {
    assert.equal(
      isAllowedNavigation('not a url', { isDev: false, indexHtmlPath }),
      false,
    )
    assert.equal(
      isAllowedNavigation('', { isDev: true, indexHtmlPath }),
      false,
    )
  })
})
