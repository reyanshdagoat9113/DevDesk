import type { ReactNode } from 'react'

interface SectionLayoutProps {
  list: ReactNode
  detail: ReactNode
}

export function SectionLayout({ list, detail }: SectionLayoutProps) {
  return (
    <div className="grid h-full gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
      {list}
      {detail}
    </div>
  )
}
