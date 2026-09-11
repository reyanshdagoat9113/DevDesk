import { describe, expect, it } from 'vitest'
import { applyCommandUpdates } from './applyCommandUpdates'
import type { Command } from '../data/model'

const current: Command = {
  id: 'cmd-1',
  name: 'Build',
  command: 'npm run build',
  description: 'Compile the app',
  tags: ['build', 'ci'],
  projectId: 'app',
  workingDirectory: 'apps/desktop',
  isPinned: true,
  pinnedAt: '2026-01-01T00:00:00.000Z',
}

describe('applyCommandUpdates', () => {
  it('keeps omitted fields unchanged', () => {
    expect(applyCommandUpdates(current, {})).toEqual(current)
    expect(applyCommandUpdates(current, undefined)).toEqual(current)
    expect(applyCommandUpdates(current, { name: 'Build All' })).toEqual({
      ...current,
      name: 'Build All',
    })
  })

  it('clears projectId with null to make a global command', () => {
    expect(applyCommandUpdates(current, { projectId: null }).projectId).toBeUndefined()
  })

  it('reassigns projectId to another project', () => {
    expect(applyCommandUpdates(current, { projectId: 'other' }).projectId).toBe('other')
  })

  it('clears workingDirectory with null', () => {
    expect(applyCommandUpdates(current, { workingDirectory: null }).workingDirectory).toBeUndefined()
  })

  it('clears description with null', () => {
    expect(applyCommandUpdates(current, { description: null }).description).toBeUndefined()
  })

  it('keeps description when the field is omitted or undefined', () => {
    expect(applyCommandUpdates(current, { description: undefined }).description).toBe('Compile the app')
    expect(applyCommandUpdates(current, { name: 'Build' }).description).toBe('Compile the app')
  })

  it('drops non-string tags and trims the rest', () => {
    expect(
      applyCommandUpdates(current, {
        tags: ['  release  ', 1, null, '', 'ci', { label: 'nope' }, true] as unknown as string[],
      }).tags
    ).toEqual(['release', 'ci'])
  })

  it('rejects empty name and command after trim', () => {
    expect(() => applyCommandUpdates(current, { name: '   ' })).toThrow('Command name is required.')
    expect(() => applyCommandUpdates(current, { command: '' })).toThrow('Command is required.')
  })
})
