import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { AppShell } from './AppShell'

const navItems = [
  { value: 'projects', label: 'Projects', count: 2, icon: ({ className }: { className?: string }) => <span className={className}>P</span> },
  { value: 'commands', label: 'Commands', count: 120, icon: ({ className }: { className?: string }) => <span className={className}>C</span> },
]

describe('AppShell sidebar density modes', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { platform: 'win32' } })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  })

  it('renders compact mode without the inherited navigation card and preserves counts', () => {
    render(<AppShell sidebarMode="compact" navItems={navItems} activeNav="projects" onNavChange={vi.fn()} title="Projects"><div>content</div></AppShell>)

    expect(screen.getByRole('complementary').className).toContain('w-[216px]')
    expect(screen.getByRole('tab', { name: 'Projects' }).textContent).toContain('2')
    expect(screen.getByRole('tab', { name: 'Commands' }).textContent).toContain('99+')
    expect(screen.getByRole('tablist').className).toContain('border-0')
    expect(screen.getByRole('tablist').className).toContain('shadow-none')
  })

  it('starts rail mode icon-only and expands labels with the sidebar toggle', () => {
    render(<AppShell sidebarMode="rail" navItems={navItems} activeNav="projects" onNavChange={vi.fn()} title="Projects"><div>content</div></AppShell>)

    expect(screen.getByRole('complementary').className).toContain('w-[56px]')
    expect(screen.getByRole('tab', { name: 'Projects' }).getAttribute('title')).toBe('Projects')
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar to show labels' }))
    expect(screen.getByRole('complementary').className).toContain('w-[216px]')
    expect(screen.getByRole('tab', { name: 'Projects' }).getAttribute('title')).toBeNull()
  })

  it('keeps the quick launcher keyboard reachable', () => {
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent')
    render(<AppShell sidebarMode="compact" navItems={navItems} activeNav="projects" onNavChange={vi.fn()} title="Projects"><div>content</div></AppShell>)

    fireEvent.click(screen.getByRole('button', { name: /Open Quick Launcher/ }))
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ key: 'k', ctrlKey: true }))
  })

  it('explains the rail behavior and exposes keyboard shortcuts', () => {
    render(<AppShell sidebarMode="rail" navItems={navItems} activeNav="projects" onNavChange={vi.fn()} title="Projects"><div>content</div></AppShell>)

    const sidebarToggle = screen.getByRole('button', { name: 'Expand sidebar to show labels' })
    fireEvent.click(sidebarToggle)
    expect(screen.getByRole('button', { name: 'Collapse sidebar to icon rail' }).getAttribute('title')).toContain('56px')
    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Quick Launcher')
    expect(dialog.textContent).toContain('F11')
    expect(dialog.textContent).toContain('56px icon rail')
  })

  it('keeps the active project context visible and switchable', async () => {
    const onProjectChange = vi.fn()
    render(
      <AppShell
        sidebarMode="rail"
        navItems={navItems}
        activeNav="projects"
        onNavChange={vi.fn()}
        title="Projects"
        projects={[
          { id: 'one', name: 'One', path: 'C:/one' },
          { id: 'two', name: 'Two', path: 'C:/two' },
        ]}
        activeProjectId="one"
        onProjectChange={onProjectChange}
      >
        <div>content</div>
      </AppShell>
    )

    const switcher = screen.getByRole('combobox', { name: 'Active project context' })
    expect(switcher.textContent).toContain('One')
    fireEvent.keyDown(switcher, { key: 'ArrowDown' })
    await userEvent.click(screen.getByRole('option', { name: /Two/ }))

    expect(onProjectChange).toHaveBeenCalledWith('two')
  })

})
