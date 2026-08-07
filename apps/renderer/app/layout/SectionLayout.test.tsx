import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionLayout } from './SectionLayout'

describe('SectionLayout', () => {
  it('stacks the list and detail panes below the desktop breakpoint', () => {
    render(<SectionLayout list={<div>List</div>} detail={<div>Detail</div>} />)

    const layout = screen.getByText('List').parentElement?.parentElement
    expect(layout?.className).toContain('flex-col')
    expect(layout?.className).toContain('lg:flex-row')
    expect(layout?.className).toContain('overflow-y-auto')
    expect(layout?.className).toContain('lg:overflow-hidden')
    expect(screen.getByText('List').parentElement?.className).toContain('w-full')
    expect(screen.getByText('List').parentElement?.className).toContain('lg:w-[260px]')
    expect(screen.getByText('Detail').parentElement?.className).toContain('min-h-[min(58vh,42rem)]')
  })
})
