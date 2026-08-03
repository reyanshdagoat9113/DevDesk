import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { AppShell } from './AppShell'

const navItems = [
  { value: 'projects', label: 'Projects', count: 2, icon: ({ className }: { className?: string }) => <span className={className}>P</span> },
  { value: 'commands', label: 'Commands', count: 120, icon: ({ className }: { className?: string }) => <span className={className}>C</span> },
]

describe('AppShell sidebar density modes', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { platform: 'win32' } })
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
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByRole('complementary').className).toContain('w-[216px]')
    expect(screen.getByRole('tab', { name: 'Projects' }).getAttribute('title')).toBeNull()
  })

  it('keeps the quick launcher keyboard reachable', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<AppShell sidebarMode="compact" navItems={navItems} activeNav="projects" onNavChange={vi.fn()} title="Projects"><div>content</div></AppShell>)

    fireEvent.click(screen.getByRole('button', { name: /Open Quick Launcher/ }))
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ key: 'k', ctrlKey: true }))
  })

})
