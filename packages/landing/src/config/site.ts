/**
 * Single source of truth for outbound links and download artifacts.
 *
 * Decision 1 of docs/landing-page-plan.md: the primary CTA is a real download served
 * from GitHub Releases. Until the 0.1.0 release assets are uploaded, keep
 * `releasePublished` false — download UI must render an unavailable state rather than
 * link to a 404.
 */

export const GITHUB_OWNER = 'reyanshdagoat9113'
export const GITHUB_REPO = 'DevDesk'
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`

/** Product version the page advertises. Keep in sync with the root package.json. */
export const APP_VERSION = '0.1.0'

/** Git tag holding the installer assets. */
export const RELEASE_TAG = `v${APP_VERSION}`
export const RELEASE_URL = `${GITHUB_URL}/releases/tag/${RELEASE_TAG}`

/**
 * Flip to true only once the release exists and every asset below resolves.
 * Verify with: npm run landing:verify-downloads
 */
export const releasePublished = false

const assetUrl = (fileName: string) =>
  `${GITHUB_URL}/releases/download/${RELEASE_TAG}/${fileName}`

export type Platform = 'windows' | 'linux'

export type DownloadArtifact = {
  id: string
  platform: Platform
  label: string
  /** Exact electron-builder artifact name (see build.artifactName in root package.json). */
  fileName: string
  url: string
  /** Honest caveats from docs/install.md:80-85. */
  notes: string[]
}

export const downloads: DownloadArtifact[] = [
  {
    id: 'win-nsis',
    platform: 'windows',
    label: 'Windows 10/11 (x64) installer',
    fileName: `DevDesk-${APP_VERSION}-win-x64.exe`,
    url: assetUrl(`DevDesk-${APP_VERSION}-win-x64.exe`),
    notes: [
      'Unsigned build — Windows SmartScreen will warn; choose More info → Run anyway.',
      'No auto-update channel in the beta.',
    ],
  },
  {
    id: 'linux-appimage',
    platform: 'linux',
    label: 'Linux (x64) AppImage',
    fileName: `DevDesk-${APP_VERSION}-linux-x64.AppImage`,
    url: assetUrl(`DevDesk-${APP_VERSION}-linux-x64.AppImage`),
    notes: ['Run chmod +x on the file before launching.'],
  },
  {
    id: 'linux-deb',
    platform: 'linux',
    label: 'Linux (x64) .deb',
    fileName: `DevDesk-${APP_VERSION}-linux-x64.deb`,
    url: assetUrl(`DevDesk-${APP_VERSION}-linux-x64.deb`),
    notes: ['Install with sudo dpkg -i <file>.'],
  },
]

/** No macOS build in this beta (build.mac.target is empty). */
export const macAvailable = false

export const systemRequirements = [
  'Windows 10/11 x64, or a x64 Linux desktop',
  'Docker Desktop or WSL Docker — optional, only for container features',
  'Roughly 400 MB free disk space',
]

export const siteMeta = {
  name: 'DevDesk',
  tagline:
    'A local-first Electron desktop app for developers that combines a Project Manager, Command Vault, Docker controls, terminals, and local code search into one workspace.',
  trustLine: 'Local-first. No account. No telemetry. No background daemons.',
  license: 'MIT',
  docsUrl: `${GITHUB_URL}/blob/main/docs/install.md`,
  supportUrl: `${GITHUB_URL}/issues/new`,
} as const
