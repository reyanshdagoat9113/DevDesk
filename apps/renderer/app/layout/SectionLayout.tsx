import type { ReactNode } from 'react'

interface SectionLayoutProps {
  list: ReactNode
  detail: ReactNode
}

export function SectionLayout({ list, detail }: SectionLayoutProps) {
  return (
    <div className="flex h-full gap-8 p-8 overflow-hidden">
      <div className="w-[260px] xl:w-[300px] flex flex-col shrink-0 min-h-0 transition-all duration-300">
        {list}
      </div>
      <div className="flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300">
        {detail}
      </div>
    </div>
  )
}
