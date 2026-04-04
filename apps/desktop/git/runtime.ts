import type { GitProvider } from './types'

export interface ParsedGitRemote {
  remoteName: string
  remoteUrl: string
  provider: GitProvider
  owner?: string
  repo?: string
  webUrl?: string
}

function stripGitSuffix(value: string) {
  return value.endsWith('.git') ? value.slice(0, -4) : value
}

export function parseGitRemote(remoteName: string, remoteUrl: string): ParsedGitRemote {
  const normalized = remoteUrl.trim()
  const httpsMatch = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (httpsMatch) {
    const owner = httpsMatch[1]
    const repo = stripGitSuffix(httpsMatch[2])
    return {
      remoteName,
      remoteUrl: normalized,
      provider: 'github',
      owner,
      repo,
      webUrl: `https://github.com/${owner}/${repo}`,
    }
  }

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    const owner = sshMatch[1]
    const repo = stripGitSuffix(sshMatch[2])
    return {
      remoteName,
      remoteUrl: normalized,
      provider: 'github',
      owner,
      repo,
      webUrl: `https://github.com/${owner}/${repo}`,
    }
  }

  const sshProtocolMatch = normalized.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshProtocolMatch) {
    const owner = sshProtocolMatch[1]
    const repo = stripGitSuffix(sshProtocolMatch[2])
    return {
      remoteName,
      remoteUrl: normalized,
      provider: 'github',
      owner,
      repo,
      webUrl: `https://github.com/${owner}/${repo}`,
    }
  }

  return {
    remoteName,
    remoteUrl: normalized,
    provider: 'unknown',
  }
}

export function inferBaseBranch(remoteHeadRef?: string | null): string | null {
  if (!remoteHeadRef) {
    return 'main'
  }

  const parts = remoteHeadRef.trim().split('/')
  return parts.length ? parts[parts.length - 1] || 'main' : 'main'
}

export function buildCompareUrl(input: {
  webUrl: string
  baseBranch: string
  headBranch: string
  title: string
  body: string
}): string {
  const params = new URLSearchParams({
    expand: '1',
    title: input.title,
    body: input.body,
  })
  return `${input.webUrl}/compare/${encodeURIComponent(input.baseBranch)}...${encodeURIComponent(input.headBranch)}?${params.toString()}`
}
