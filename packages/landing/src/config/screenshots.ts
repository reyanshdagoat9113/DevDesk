/**
 * Product screenshot manifest (Phase 2 of docs/landing-page-plan.md).
 *
 * Capture rules — every file must follow them or the layout drifts:
 *   - App window sized to exactly 1600x1000 CSS px, dark theme, 1x DPI.
 *   - Real but presentable data; no personal paths, tokens, or private repo names.
 *   - PNG, stored in packages/landing/public/screenshots/ under the `file` name below.
 *
 * `npm run landing:verify-assets` checks presence and dimensions.
 * `section` maps each shot to the feature row that consumes it, mirroring the app's own
 * navigation in apps/renderer/app/lib/appShell.ts.
 */

export const SCREENSHOT_WIDTH = 1600
export const SCREENSHOT_HEIGHT = 1000
export const SCREENSHOT_DIR = '/screenshots'

export type ScreenshotId =
  | 'projects'
  | 'commands'
  | 'engine'
  | 'containers'
  | 'terminal'
  | 'history'
  | 'git'

export type Screenshot = {
  id: ScreenshotId
  /** File name inside public/screenshots/. */
  file: string
  src: string
  /** Alt text is required, not decorative: these images carry the product story. */
  alt: string
  /** In-app view to capture. */
  capture: string
  /** True for the shot used in the hero. */
  hero?: boolean
}

const shot = (
  id: ScreenshotId,
  alt: string,
  capture: string,
  hero = false,
): Screenshot => ({
  id,
  file: `${id}.png`,
  src: `${SCREENSHOT_DIR}/${id}.png`,
  alt,
  capture,
  hero,
})

export const screenshots: Screenshot[] = [
  shot(
    'projects',
    'DevDesk Projects view listing local repositories with their git branch, health status, and quick actions.',
    'Projects tab with 4-6 projects added, one selected.',
    true,
  ),
  shot(
    'commands',
    'DevDesk Command Vault showing saved commands with variables, presets, and a chain ready to run.',
    'Commands tab with a preset expanded and a chain visible.',
  ),
  shot(
    'terminal',
    'An embedded DevDesk terminal running a project command with live output.',
    'Terminal tab with one session running a build command.',
  ),
  shot(
    'containers',
    'DevDesk Containers view listing Docker containers with status, ports, and start/stop controls.',
    'Containers tab with at least two containers, one running.',
  ),
  shot(
    'engine',
    'DevDesk local code search returning ranked matches across a project with file paths and line previews.',
    'Engine tab after a search that returns several ranked results.',
  ),
  shot(
    'history',
    'DevDesk run history listing past command runs with exit status, duration, and captured output.',
    'History tab with several past runs, one expanded to show its output.',
  ),
  shot(
    'git',
    'DevDesk git workspace showing branch, staged and unstaged changes, and a diff for the selected file.',
    'Git workspace panel with staged and unstaged changes present.',
  ),
]

export const heroScreenshot = screenshots.find((item) => item.hero) ?? screenshots[0]
