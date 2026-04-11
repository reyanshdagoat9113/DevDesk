import { describe, expect, it } from 'vitest'
import { buildCompareUrl, inferBaseBranch, parseGitRemote } from './runtime'

describe('git runtime helpers', () => {
  it('parses GitHub remotes across URL formats', () => {
    expect(parseGitRemote('origin', 'https://github.com/foo/bar.git')).toMatchObject({ provider: 'github', owner: 'foo', repo: 'bar', webUrl: 'https://github.com/foo/bar' })
    expect(parseGitRemote('origin', 'git@github.com:foo/bar.git')).toMatchObject({ provider: 'github', owner: 'foo', repo: 'bar' })
    expect(parseGitRemote('origin', 'ssh://git@github.com/foo/bar.git')).toMatchObject({ provider: 'github', owner: 'foo', repo: 'bar' })
    expect(parseGitRemote('origin', 'https://gitlab.com/foo/bar')).toMatchObject({ provider: 'unknown' })
  })

  it('infers a base branch and builds compare urls', () => {
    expect(inferBaseBranch('refs/remotes/origin/main')).toBe('main')
    expect(inferBaseBranch(null)).toBe('main')
    const url = buildCompareUrl({ webUrl: 'https://github.com/foo/bar', baseBranch: 'main', headBranch: 'feature/test', title: 'Hello', body: 'World' })
    expect(url).toContain('/compare/main...feature%2Ftest')
    expect(url).toContain('title=Hello')
    expect(url).toContain('body=World')
  })
})
