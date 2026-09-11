import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEV_RENDERER_ORIGINS = [
  'http://127.0.0.1:5180',
  'http://localhost:5180',
] as const

function normalizeFsPath(filePath: string): string {
  const resolved = path.resolve(path.normalize(filePath))
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function isAllowedNavigation(
  url: string,
  options: { isDev: boolean; indexHtmlPath: string },
): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (options.isDev) {
    if (parsed.protocol !== 'http:') {
      return false
    }
    const origin = `${parsed.protocol}//${parsed.host}`
    return (DEV_RENDERER_ORIGINS as readonly string[]).includes(origin)
  }

  if (parsed.protocol !== 'file:') {
    return false
  }

  let targetPath: string
  try {
    targetPath = fileURLToPath(parsed)
  } catch {
    return false
  }

  return normalizeFsPath(targetPath) === normalizeFsPath(options.indexHtmlPath)
}
