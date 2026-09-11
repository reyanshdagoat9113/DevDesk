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

async function ensureAttachmentsDir(): Promise<string> {
  const dir = getAttachmentsDir()
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}

export async function copyFileToAttachments(sourceFilePath: string): Promise<{ relativePath: string; fileSize: number }> {
  if (!sourceFilePath || typeof sourceFilePath !== 'string') {
    throw new Error('Source file path is required.')
  }

  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(sourceFilePath)
  } catch {
    throw new Error(`Source file does not exist: ${sourceFilePath}`)
  }
  if (!stat.isFile()) {
    throw new Error(`Source path is not a file: ${sourceFilePath}`)
  }
  if (stat.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment exceeds maximum size of ${MAX_ATTACHMENT_BYTES} bytes.`)
  }

  await ensureAttachmentsDir()
  const ext = path.extname(sourceFilePath).slice(0, 32)
  const storedName = `${randomUUID()}${ext}`
  const destPath = resolveAttachmentPath(path.join(ATTACHMENTS_DIR, storedName))

  await fs.promises.copyFile(sourceFilePath, destPath)

  return {
    relativePath: path.join(ATTACHMENTS_DIR, storedName),
    fileSize: stat.size,
  }
}

export { MAX_ATTACHMENT_BYTES }
