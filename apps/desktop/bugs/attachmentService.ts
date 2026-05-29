import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { getUserDataDir } from '../data/store/shared'

const ATTACHMENTS_DIR = 'attachments'

export function getAttachmentsDir(): string {
  return path.join(getUserDataDir(), ATTACHMENTS_DIR)
}

function ensureAttachmentsDir(): string {
  const dir = getAttachmentsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function copyFileToAttachments(sourceFilePath: string): { relativePath: string; fileSize: number } {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Source file does not exist: ${sourceFilePath}`)
  }

  const stat = fs.statSync(sourceFilePath)
  if (!stat.isFile()) {
    throw new Error(`Source path is not a file: ${sourceFilePath}`)
  }

  const dir = ensureAttachmentsDir()
  const ext = path.extname(sourceFilePath)
  const storedName = `${randomUUID()}${ext}`
  const destPath = path.join(dir, storedName)

  fs.copyFileSync(sourceFilePath, destPath)

  return {
    relativePath: path.join(ATTACHMENTS_DIR, storedName),
    fileSize: stat.size,
  }
}

export function deleteAttachmentFile(relativePath: string): void {
  const absPath = path.join(getUserDataDir(), relativePath)
  if (fs.existsSync(absPath)) {
    fs.unlinkSync(absPath)
  }
}

export function resolveAttachmentPath(relativePath: string): string {
  return path.join(getUserDataDir(), relativePath)
}
