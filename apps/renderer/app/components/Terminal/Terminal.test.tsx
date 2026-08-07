import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Terminal } from './Terminal'

const terminalApi = {
  onTerminalData: vi.fn(() => () => {}),
  onTerminalExit: vi.fn(() => () => {}),
  onTerminalError: vi.fn(() => () => {}),
  writeTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
}

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80
    rows = 24
    options = { fontSize: 14 }
    attachCustomKeyEventHandler() {}
    loadAddon() {}
    open() {}
    onData() { return { dispose: vi.fn() } }
    onResize() {}
    hasSelection() { return false }
    getSelection() { return '' }
    write() {}
    paste() {}
    dispose() {}
  },
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class {} }))
vi.mock('@xterm/addon-search', () => ({ SearchAddon: class {} }))
vi.mock('@xterm/addon-webgl', () => ({ WebglAddon: class { onContextLoss() {} dispose() {} } }))

describe('Terminal', () => {
  it('opens a semantic context menu, handles Escape, and restores focus', () => {
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: terminalApi })
    const onClose = vi.fn()
    render(<Terminal terminalId="terminal-1" onClose={onClose} />)
    const root = screen.getByLabelText('Terminal terminal-1')

    fireEvent.contextMenu(root)

    expect(screen.getByRole('menu', { name: 'Terminal actions' })).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(8)
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Paste' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(root)
  })
})
