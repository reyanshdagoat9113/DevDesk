import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'
import { buildContentSecurityPolicy } from './cspPolicy'

describe('buildContentSecurityPolicy', () => {
  it('omits unsafe script sources and HMR origins in production', () => {
    const policy = buildContentSecurityPolicy(false)
    assert.match(policy, /script-src 'self'/)
    assert.doesNotMatch(policy, /unsafe-eval/)
    assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/)
    assert.match(policy, /style-src 'self' 'unsafe-inline'/)
    assert.match(policy, /connect-src 'self'/)
    assert.doesNotMatch(policy, /localhost:5180/)
    assert.doesNotMatch(policy, /127\.0\.0\.1:5180/)
  })

  it('matches the renderer index.html meta CSP', () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../renderer/index.html'),
      'utf8',
    )
    const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)
    assert.ok(match)
    assert.equal(match[1], buildContentSecurityPolicy(false))
  })

  it('allows Vite HMR connect-src and inline scripts in development', () => {
    const policy = buildContentSecurityPolicy(true)
    assert.match(policy, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/)
    assert.match(policy, /connect-src 'self'/)
    assert.match(policy, /ws:\/\/localhost:5180/)
    assert.match(policy, /ws:\/\/127\.0\.0\.1:5180/)
    assert.match(policy, /http:\/\/localhost:5180/)
    assert.match(policy, /http:\/\/127\.0\.0\.1:5180/)
  })
})
