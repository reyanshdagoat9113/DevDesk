import type { ReactNode } from 'react'

interface SectionLayoutProps {
  list: ReactNode
  detail: ReactNode
}

export function SectionLayout({ list, detail }: SectionLayoutProps) {
  return (
    <div className="flex h-full gap-6 overflow-hidden">
      <div className="w-[300px] xl:w-[340px] flex flex-col shrink-0 min-h-0">
        {list}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        {detail}
      </div>
    </div>
  )
}
