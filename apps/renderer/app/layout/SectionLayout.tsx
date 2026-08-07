import type { ReactNode } from 'react'

interface SectionLayoutProps {
  list: ReactNode
  detail: ReactNode
}

export function SectionLayout({ list, detail }: SectionLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5 lg:flex-row lg:gap-5 lg:overflow-hidden lg:p-6">
      <div className="flex h-[min(42vh,26rem)] min-h-[15rem] w-full shrink-0 flex-col transition-all duration-300 lg:h-auto lg:min-h-0 lg:w-[260px] lg:flex-none xl:w-[300px] 2xl:w-[320px]">
        {list}
      </div>
      <div className="flex min-h-[min(58vh,42rem)] min-w-0 flex-1 flex-col transition-all duration-300 lg:min-h-0">
        {detail}
      </div>
    </div>
  )
}
