import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type Database from 'better-sqlite3'
import { afterEach, describe, it, vi } from 'vitest'

let tempRoot = ''
let openDb: Database.Database | null = null

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: () => tempRoot || os.tmpdir(),
  },
}))

afterEach(async () => {
  const { __resetDbForTests } = await import('./core')
  try {
    openDb?.close()
  } catch {
    // ignore
  }
  openDb = null
  __resetDbForTests()
  if (tempRoot && fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
  tempRoot = ''
})

async function initializeStore(prefix: string) {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const { initializeDatabaseAt, __setDbForTests } = await import('./core')
  openDb = await initializeDatabaseAt(
    path.join(tempRoot, 'devdesk.db'),
    path.join(tempRoot, 'devdesk-store.json'),
  )
  __setDbForTests(openDb)
}

async function createProjectAttachment(projectId: string) {
  const { copyFileToAttachments, resolveAttachmentPath } = await import('../../bugs/attachmentService')
  const { createProject } = await import('./projects')
  const { addBugAttachmentRecord, createBugReport } = await import('./bugs')

  await createProject({
    id: projectId,
    path: path.join(tempRoot, projectId),
    name: projectId,
    type: 'node',
    icon: 'box',
    linkedContainerNames: [],
    isPinned: false,
  })

  const sourceFilePath = path.join(tempRoot, `${projectId}.log`)
  fs.writeFileSync(sourceFilePath, 'attachment contents')
  const copied = copyFileToAttachments(sourceFilePath)
  const report = await createBugReport({ projectId, title: 'Attached bug' })
  await addBugAttachmentRecord({
    bugReportId: report.id,
    sourceFilePath,
    storedRelativePath: copied.relativePath,
    fileSize: copied.fileSize,
  })

  return { report, absolutePath: resolveAttachmentPath(copied.relativePath) }
}

describe('attachment file lifecycle', () => {
  it('removes project attachment rows and files with the deleted project', async () => {
    await initializeStore('devdesk-project-attachment-')
    const { removeProject } = await import('./projects')
    const { listBugAttachments } = await import('./bugs')
    const { report, absolutePath } = await createProjectAttachment('project-1')

    assert.equal(fs.existsSync(absolutePath), true)
    await removeProject('project-1')

    assert.deepEqual(await listBugAttachments(report.id), [])
    assert.equal(fs.existsSync(absolutePath), false)
  })

  it('removes replaced attachment rows and files after a replace import', async () => {
    await initializeStore('devdesk-import-attachment-')
    const { importAllData, EXPORT_VERSION, TABLE_NAMES } = await import('./export')
    const { getDbOrThrow } = await import('./core')
    const { report, absolutePath } = await createProjectAttachment('project-1')
    const tables: Record<string, unknown[][]> = {}
    for (const tableName of TABLE_NAMES) {
      tables[tableName] = []
    }

    assert.equal(fs.existsSync(absolutePath), true)
    const result = await importAllData(
      {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        platform: process.platform,
        tables,
      },
      'replace',
    )

    assert.equal(result.success, true, result.error)
    const attachment = getDbOrThrow()
      .prepare('SELECT id FROM bug_attachments WHERE bug_report_id = ?')
      .get(report.id)
    assert.equal(attachment, undefined)
    assert.equal(fs.existsSync(absolutePath), false)
  })
})
