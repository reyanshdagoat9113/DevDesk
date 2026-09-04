import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  ATTACHMENTS_DIR,
  deleteAttachmentFile,
  getAttachmentsDir,
  resolveAttachmentPath,
} from '../data/store/attachments'

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export { deleteAttachmentFile, getAttachmentsDir, resolveAttachmentPath }

function ensureAttachmentsDir(): string {
  const dir = getAttachmentsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function copyFileToAttachments(sourceFilePath: string): { relativePath: string; fileSize: number } {
  if (!sourceFilePath || typeof sourceFilePath !== 'string') {
    throw new Error('Source file path is required.')
  }
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Source file does not exist: ${sourceFilePath}`)
  }

  const stat = fs.statSync(sourceFilePath)
  if (!stat.isFile()) {
    throw new Error(`Source path is not a file: ${sourceFilePath}`)
  }
  if (stat.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment exceeds maximum size of ${MAX_ATTACHMENT_BYTES} bytes.`)
  }

  ensureAttachmentsDir()
  const ext = path.extname(sourceFilePath).slice(0, 32)
  const storedName = `${randomUUID()}${ext}`
  const destPath = resolveAttachmentPath(path.join(ATTACHMENTS_DIR, storedName))

  fs.copyFileSync(sourceFilePath, destPath)

  return {
    relativePath: path.join(ATTACHMENTS_DIR, storedName),
    fileSize: stat.size,
  }
}

export { MAX_ATTACHMENT_BYTES }
