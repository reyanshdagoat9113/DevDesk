import type { ReactNode } from 'react'

interface SectionLayoutProps {
  list: ReactNode
  detail: ReactNode
}

export function SectionLayout({ list, detail }: SectionLayoutProps) {
  return (
    <div className="flex h-full gap-5 overflow-hidden p-5 lg:gap-6 lg:p-6 xl:gap-8 xl:p-8">
      <div className="flex w-[260px] shrink-0 flex-col min-h-0 transition-all duration-300 xl:w-[300px] 2xl:w-[320px]">
        {list}
      </div>
      <div className="flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300">
        {detail}
      </div>
    </div>
  )
}
