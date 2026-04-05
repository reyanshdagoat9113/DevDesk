import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCompareUrl, inferBaseBranch, parseGitRemote } from './runtime'

test('parseGitRemote recognizes github https remotes', () => {
  const parsed = parseGitRemote('origin', 'https://github.com/acme/devdesk.git')

  assert.equal(parsed.provider, 'github')
  assert.equal(parsed.owner, 'acme')
  assert.equal(parsed.repo, 'devdesk')
  assert.equal(parsed.webUrl, 'https://github.com/acme/devdesk')
})

test('parseGitRemote recognizes github ssh remotes', () => {
  const parsed = parseGitRemote('origin', 'git@github.com:acme/devdesk.git')

  assert.equal(parsed.provider, 'github')
  assert.equal(parsed.owner, 'acme')
  assert.equal(parsed.repo, 'devdesk')
})

test('inferBaseBranch defaults to main when remote head is unavailable', () => {
  assert.equal(inferBaseBranch(null), 'main')
})

test('inferBaseBranch extracts the branch name from remote HEAD refs', () => {
  assert.equal(inferBaseBranch('refs/remotes/origin/dev'), 'dev')
})

test('buildCompareUrl encodes title and body for browser PR flows', () => {
  const url = buildCompareUrl({
    webUrl: 'https://github.com/acme/devdesk',
    baseBranch: 'main',
    headBranch: 'feature/git-workspace',
    title: 'Add git workspace',
    body: 'Includes commit and push support.',
  })

  assert.equal(
    url,
    'https://github.com/acme/devdesk/compare/main...feature%2Fgit-workspace?expand=1&title=Add+git+workspace&body=Includes+commit+and+push+support.'
  )
})
