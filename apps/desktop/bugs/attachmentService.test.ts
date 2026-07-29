import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

let tempRoot = ''

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: (name: string) => {
      if (name === 'userData') return tempRoot || os.tmpdir()
      return os.tmpdir()
    },
  },
}))

const {
  copyFileToAttachments,
  deleteAttachmentFile,
  getAttachmentsDir,
  resolveAttachmentPath,
} = await import('./attachmentService')

describe('attachmentService confinement', () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devdesk-attach-'))
  })

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
    tempRoot = ''
  })

  it('copies files under attachments and resolves them', () => {
    const source = path.join(tempRoot, 'source.txt')
    fs.writeFileSync(source, 'hello')
    const { relativePath, fileSize } = copyFileToAttachments(source)
    assert.equal(fileSize, 5)
    assert.match(relativePath.replace(/\\/g, '/'), /^attachments\//)
    const resolved = resolveAttachmentPath(relativePath)
    assert.ok(resolved.startsWith(getAttachmentsDir()))
    assert.equal(fs.readFileSync(resolved, 'utf8'), 'hello')
    deleteAttachmentFile(relativePath)
    assert.equal(fs.existsSync(resolved), false)
  })

  it('rejects path traversal on resolve and delete', () => {
    assert.throws(() => resolveAttachmentPath('../evil.txt'), /traversal|under the attachments|escapes/i)
    assert.throws(() => resolveAttachmentPath(path.resolve(tempRoot, 'outside.txt')), /Absolute|not allowed/i)
    assert.throws(() => deleteAttachmentFile('attachments/../../evil.txt'), /traversal|escapes|under/i)
  })
})
