import { describe, expect, it } from 'vitest'
import { shouldHandlePaletteToggle } from './commandPaletteHelpers'

describe('shouldHandlePaletteToggle', () => {
  it('handles Ctrl/Cmd+K even when an input would be focused', () => {
    expect(shouldHandlePaletteToggle({ key: 'k', ctrlKey: true, metaKey: false })).toBe(true)
    expect(shouldHandlePaletteToggle({ key: 'K', metaKey: true, ctrlKey: false })).toBe(true)
  })

  it('ignores plain k and other modified keys', () => {
    expect(shouldHandlePaletteToggle({ key: 'k', ctrlKey: false, metaKey: false })).toBe(false)
    expect(shouldHandlePaletteToggle({ key: 'p', ctrlKey: true, metaKey: false })).toBe(false)
  })
})
