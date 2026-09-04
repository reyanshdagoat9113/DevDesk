import fs from 'node:fs'
import path from 'node:path'

import { getUserDataDir } from './shared'

export const ATTACHMENTS_DIR = 'attachments'

export function getAttachmentsDir(): string {
  return path.join(getUserDataDir(), ATTACHMENTS_DIR)
}

function assertInsideRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidate)
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(prefix)) {
    throw new Error('Path escapes the allowed attachments root.')
  }
  return resolvedCandidate
}

/** Resolve a stored relative path and ensure it stays under userData/attachments. */
export function resolveAttachmentPath(relativePath: string): string {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new Error('Attachment path is required.')
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error('Absolute attachment paths are not allowed.')
  }
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.includes('\0') || normalized.split('/').some((part) => part === '..')) {
    throw new Error('Attachment path traversal is not allowed.')
  }
  if (!normalized.startsWith(`${ATTACHMENTS_DIR}/`) && normalized !== ATTACHMENTS_DIR) {
    throw new Error('Attachment path must be under the attachments directory.')
  }

  const userData = path.resolve(getUserDataDir())
  const absPath = path.resolve(userData, normalized)
  return assertInsideRoot(path.join(userData, ATTACHMENTS_DIR), absPath)
}

export function deleteAttachmentFile(relativePath: string): void {
  const absPath = resolveAttachmentPath(relativePath)
  if (fs.existsSync(absPath)) {
    fs.unlinkSync(absPath)
  }
}
